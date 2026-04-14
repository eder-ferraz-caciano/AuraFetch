use std::io::Read;
use std::sync::Mutex;
use tauri::Emitter;
use sha1::Sha1;
use sha1::Digest;

struct FfmpegProcess(Mutex<Option<std::process::Child>>);

/// Try to locate the ffmpeg binary: first on PATH, then in common install locations.
fn find_ffmpeg() -> Option<String> {
    if std::process::Command::new("ffmpeg")
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .and_then(|mut c| c.wait())
        .is_ok()
    {
        return Some("ffmpeg".to_string());
    }

    if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
        let winget_dir =
            std::path::PathBuf::from(&local_app).join("Microsoft").join("WinGet").join("Packages");
        if winget_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&winget_dir) {
                for entry in entries.flatten() {
                    if entry.file_name().to_string_lossy().contains("FFmpeg") {
                        let candidate = entry.path().join("ffmpeg-8.1-full_build").join("bin").join("ffmpeg.exe");
                        if candidate.is_file() {
                            return Some(candidate.to_string_lossy().to_string());
                        }
                        if let Ok(sub) = std::fs::read_dir(entry.path()) {
                            for s in sub.flatten() {
                                let bin = s.path().join("bin").join("ffmpeg.exe");
                                if bin.is_file() {
                                    return Some(bin.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    for path in [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\tools\ffmpeg\bin\ffmpeg.exe",
    ] {
        if std::path::Path::new(path).is_file() {
            return Some(path.to_string());
        }
    }

    None
}

fn find_jpeg_end(buf: &[u8]) -> Option<usize> {
    for i in 0..buf.len().saturating_sub(1) {
        if buf[i] == 0xFF && buf[i + 1] == 0xD9 {
            return Some(i + 2);
        }
    }
    None
}

fn find_jpeg_start(buf: &[u8]) -> Option<usize> {
    for i in 0..buf.len().saturating_sub(2) {
        if buf[i] == 0xFF && buf[i + 1] == 0xD8 && buf[i + 2] == 0xFF {
            return Some(i);
        }
    }
    None
}

/// Single ffmpeg process: video (MJPEG) → stdout, audio (PCM s16le) → stderr (pipe:2).
/// Uses -loglevel quiet so stderr only carries raw audio data.
#[tauri::command]
fn start_rtsp_stream(
    app: tauri::AppHandle,
    state: tauri::State<FfmpegProcess>,
    url: String,
) -> Result<(), String> {
    {
        let mut guard = state.0.lock().unwrap();
        if let Some(ref mut child) = *guard {
            child.kill().ok();
            child.wait().ok();
        }
        *guard = None;
    }

    let ffmpeg_bin = find_ffmpeg().ok_or_else(|| {
        "ffmpeg não encontrado. Instale o ffmpeg e adicione ao PATH.".to_string()
    })?;

    let mut child = std::process::Command::new(&ffmpeg_bin)
        .args([
            "-loglevel", "quiet",
            "-rtsp_transport", "udp",
            "-i", &url,
            // Video → stdout
            "-map", "0:v",
            "-vf", "fps=3",
            "-f", "image2pipe",
            "-vcodec", "mjpeg",
            "-q:v", "5",
            "pipe:1",
            // Audio → stderr (pipe:2), optional (? = skip if no audio track)
            "-map", "0:a?",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            "-f", "s16le",
            "pipe:2",
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Falha ao iniciar ffmpeg ({ffmpeg_bin}): {e}"))?;

    let stdout = child.stdout.take().ok_or("Falha ao capturar stdout")?;
    let stderr = child.stderr.take();

    {
        let mut guard = state.0.lock().unwrap();
        *guard = Some(child);
    }

    // Audio reader thread (stderr = raw PCM s16le data)
    if let Some(stderr) = stderr {
        let app_audio = app.clone();
        std::thread::spawn(move || {
            use base64::Engine as _;
            let mut reader = std::io::BufReader::new(stderr);
            let mut chunk = [0u8; 3200]; // 100ms of 16kHz mono s16le
            loop {
                match reader.read_exact(&mut chunk) {
                    Ok(()) => {
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&chunk);
                        app_audio.emit("rtsp-audio", b64).ok();
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Video reader thread (stdout = MJPEG frames)
    std::thread::spawn(move || {
        use base64::Engine as _;

        let mut reader = std::io::BufReader::new(stdout);
        let mut buf: Vec<u8> = Vec::new();
        let mut tmp = [0u8; 8192];

        loop {
            match reader.read(&mut tmp) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    buf.extend_from_slice(&tmp[..n]);

                    if let Some(start) = find_jpeg_start(&buf) {
                        if start > 0 { buf.drain(..start); }
                    } else {
                        if buf.len() > 4 { buf.clear(); }
                        continue;
                    }

                    while let Some(end) = find_jpeg_end(&buf) {
                        let frame = buf[..end].to_vec();
                        buf.drain(..end);

                        let b64 = base64::engine::general_purpose::STANDARD.encode(&frame);
                        app.emit("rtsp-frame", b64).ok();

                        if let Some(next_start) = find_jpeg_start(&buf) {
                            if next_start > 0 { buf.drain(..next_start); }
                        } else {
                            break;
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_rtsp_stream(state: tauri::State<FfmpegProcess>) {
    let mut guard = state.0.lock().unwrap();
    if let Some(ref mut child) = *guard {
        child.kill().ok();
        child.wait().ok();
    }
    *guard = None;
}

#[tauri::command]
fn rtsp_snapshot(url: String) -> Result<String, String> {
    let ffmpeg_bin = find_ffmpeg().ok_or_else(|| {
        "ffmpeg não encontrado. Instale o ffmpeg e adicione ao PATH.".to_string()
    })?;

    let output = std::process::Command::new(&ffmpeg_bin)
        .args([
            "-rtsp_transport", "udp",
            "-i", &url,
            "-vf", "fps=1",
            "-frames:v", "1",
            "-f", "image2pipe",
            "-vcodec", "mjpeg",
            "-q:v", "2",
            "pipe:1",
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output()
        .map_err(|e| format!("Falha ao executar ffmpeg: {e}"))?;

    if output.stdout.is_empty() {
        return Err("ffmpeg não retornou nenhum frame. Verifique a URL RTSP.".to_string());
    }

    use base64::Engine as _;
    Ok(base64::engine::general_purpose::STANDARD.encode(&output.stdout))
}

/// PTZ via RTSP SET_PARAMETER (Yoosee/GWIPC cameras).
/// Opens a fresh TCP connection to port 554, sends the command, reads the response.
#[tauri::command]
fn rtsp_ptz(url: String, direction: String) -> Result<String, String> {
    use std::io::Write;

    // Parse host from rtsp://user:pass@host:port/path
    let stripped = url
        .strip_prefix("rtsp://")
        .ok_or("URL deve começar com rtsp://")?;
    let after_auth = if let Some(at) = stripped.find('@') {
        &stripped[at + 1..]
    } else {
        stripped
    };
    let host = after_auth.split('/').next().unwrap_or(after_auth);
    let (ip, port) = if let Some(colon) = host.rfind(':') {
        (&host[..colon], host[colon + 1..].parse::<u16>().unwrap_or(554))
    } else {
        (host, 554u16)
    };

    let msg = format!(
        "SET_PARAMETER {} RTSP/1.0\r\n\
         CSeq: 0\r\n\
         LibVLC/2.2.1 (LIVE555 Streaming Media v2014.07.25)\r\n\
         Accept: application/sdp\r\n\
         Content-length: strlen(Content-type)\r\n\
         Content-type: ptzCmd:{}\r\n\
         \r\n",
        url, direction
    );

    let addr = format!("{ip}:{port}");
    let mut stream = std::net::TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Endereço inválido: {e}"))?,
        std::time::Duration::from_secs(3),
    )
    .map_err(|e| format!("Conexão TCP falhou ({addr}): {e}"))?;

    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(3)))
        .ok();
    stream
        .write_all(msg.as_bytes())
        .map_err(|e| format!("Falha ao enviar comando: {e}"))?;

    let mut response = vec![0u8; 1024];
    let n = stream.read(&mut response).unwrap_or(0);
    let resp_str = String::from_utf8_lossy(&response[..n]).to_string();

    if resp_str.contains("200 OK") {
        Ok(resp_str)
    } else if resp_str.is_empty() {
        Ok("Comando enviado (sem resposta)".to_string())
    } else {
        Err(format!("Resposta inesperada: {resp_str}"))
    }
}

/// Build WS-UsernameToken header for ONVIF SOAP authentication.
fn build_wsse_header(user: &str, pass: &str) -> String {
    use base64::Engine as _;
    use rand::Rng;

    let mut nonce_bytes = [0u8; 16];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce_b64 = base64::engine::general_purpose::STANDARD.encode(&nonce_bytes);

    let created = chrono_lite_now();

    // Digest = Base64(SHA1(nonce + created + password))
    let mut hasher = Sha1::new();
    hasher.update(&nonce_bytes);
    hasher.update(created.as_bytes());
    hasher.update(pass.as_bytes());
    let digest_bytes = hasher.finalize();
    let digest_b64 = base64::engine::general_purpose::STANDARD.encode(&digest_bytes);

    format!(
        r#"<Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"><UsernameToken><Username>{user}</Username><Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest_b64}</Password><Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</Nonce><Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">{created}</Created></UsernameToken></Security>"#
    )
}

/// Minimal UTC timestamp in ISO 8601 format without pulling in chrono.
fn chrono_lite_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();
    // seconds → Y/M/D H:M:S (simplified leap-year-aware)
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let h = time_secs / 3600;
    let m = (time_secs % 3600) / 60;
    let s = time_secs % 60;

    let mut y: u64 = 1970;
    let mut remaining = days;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining < days_in_year { break; }
        remaining -= days_in_year;
        y += 1;
    }
    let month_days: [u64; 12] = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut mo = 0u64;
    for &md in &month_days {
        if remaining < md { break; }
        remaining -= md;
        mo += 1;
    }
    format!("{y:04}-{:02}-{:02}T{h:02}:{m:02}:{s:02}Z", mo + 1, remaining + 1)
}

fn is_leap(y: u64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/// ONVIF ContinuousMove on Yoosee cameras (port 5000, /onvif/deviceio_service).
#[tauri::command]
fn onvif_ptz_move(ip: String, port: u16, user: String, pass: String, pan_x: f64, pan_y: f64) -> Result<String, String> {
    let wsse = build_wsse_header(&user, &pass);
    let body = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema"><s:Header>{wsse}</s:Header><s:Body><tptz:ContinuousMove><tptz:ProfileToken>IPCProfilesToken1</tptz:ProfileToken><tptz:Velocity><tt:PanTilt x="{pan_x}" y="{pan_y}"/></tptz:Velocity></tptz:ContinuousMove></s:Body></s:Envelope>"#
    );

    let url = format!("http://{}:{}/onvif/deviceio_service", ip, port);
    send_onvif_soap(&url, &body, "ContinuousMove")
}

/// ONVIF Stop on Yoosee cameras.
#[tauri::command]
fn onvif_ptz_stop(ip: String, port: u16, user: String, pass: String) -> Result<String, String> {
    let wsse = build_wsse_header(&user, &pass);
    let body = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"><s:Header>{wsse}</s:Header><s:Body><tptz:Stop><tptz:ProfileToken>IPCProfilesToken1</tptz:ProfileToken><tptz:PanTilt>true</tptz:PanTilt><tptz:Zoom>true</tptz:Zoom></tptz:Stop></s:Body></s:Envelope>"#
    );

    let url = format!("http://{}:{}/onvif/deviceio_service", ip, port);
    send_onvif_soap(&url, &body, "Stop")
}

/// Send a SOAP request to the ONVIF endpoint and return the response.
/// Send a SOAP request to the ONVIF endpoint. Fire-and-forget friendly:
/// short timeouts and empty responses treated as success (camera processes but may not reply).
fn send_onvif_soap(url: &str, body: &str, action: &str) -> Result<String, String> {
    use std::io::Write;

    let content_type = format!(
        "application/soap+xml;charset=UTF8; action=\"http://www.onvif.org/ver20/ptz/wsdl/{}\"",
        action
    );

    let stripped = url.strip_prefix("http://").ok_or("URL inválida")?;
    let host_part = stripped.split('/').next().unwrap_or(stripped);

    let addr: std::net::SocketAddr = host_part
        .parse()
        .map_err(|e| format!("Endereço inválido: {e}"))?;

    let mut stream = std::net::TcpStream::connect_timeout(
        &addr,
        std::time::Duration::from_millis(1500),
    )
    .map_err(|e| format!("Conexão TCP falhou ({host_part}): {e}"))?;

    // Short read timeout — camera may not reply at all
    stream
        .set_read_timeout(Some(std::time::Duration::from_millis(800)))
        .ok();
    stream
        .set_write_timeout(Some(std::time::Duration::from_millis(1000)))
        .ok();

    let path = stripped.find('/').map(|i| &stripped[i..]).unwrap_or("/");
    let request = format!(
        "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path, host_part, content_type, body.len(), body
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("Falha ao enviar SOAP: {e}"))?;

    let mut response = Vec::new();
    stream.read_to_end(&mut response).ok();
    let resp_str = String::from_utf8_lossy(&response).to_string();

    if resp_str.is_empty() {
        // Camera received the command but didn't reply — this is normal for Yoosee
        Ok("OK (sem resposta)".to_string())
    } else if resp_str.contains("200 OK") || resp_str.contains("Response") {
        Ok("OK".to_string())
    } else {
        Err(format!("Resposta ONVIF: {}", &resp_str[..resp_str.len().min(300)]))
    }
}

/// Run a single ICMP ping via the system `ping` command and return the round-trip time in ms.
#[tauri::command]
fn ping_host(host: String) -> Result<f64, String> {
    let output = std::process::Command::new("ping")
        .args(["-n", "1", "-w", "5000", &host])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("Falha ao executar ping: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    if output.status.success() && !stdout.contains("could not find host")
        && !stdout.contains("Request timed out")
        && !stdout.contains("Esgotado o tempo limite")
        && !stdout.contains("unreachable")
    {
        // Try to extract time from "time=XXms" or "tempo=XXms" or "time<1ms"
        if let Some(cap) = stdout.find("time=").or_else(|| stdout.find("tempo=").or_else(|| stdout.find("time<"))) {
            let after = &stdout[cap..];
            let start = after.find('=').or_else(|| after.find('<')).unwrap_or(0) + 1;
            let num_str: String = after[start..].chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
            if let Ok(ms) = num_str.parse::<f64>() {
                return Ok(ms);
            }
        }
        // Fallback: ping succeeded but couldn't parse time
        Ok(0.0)
    } else {
        let err_msg = if stdout.contains("could not find host") || stdout.contains("Nao foi possivel") {
            "Host nao encontrado"
        } else if stdout.contains("Request timed out") || stdout.contains("Esgotado") {
            "Timeout"
        } else if stdout.contains("unreachable") {
            "Host inacessivel"
        } else {
            "Ping falhou"
        };
        Err(err_msg.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(FfmpegProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![start_rtsp_stream, stop_rtsp_stream, rtsp_snapshot, rtsp_ptz, onvif_ptz_move, onvif_ptz_stop, ping_host])
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
