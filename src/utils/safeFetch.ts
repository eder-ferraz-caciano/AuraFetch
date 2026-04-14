import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriHttpFetch } from '@tauri-apps/plugin-http';
import { readFile as tauriReadFile } from '@tauri-apps/plugin-fs';

export const MAX_FILE_UPLOAD_MB = 50;
export const MAX_FILE_UPLOAD_BYTES = MAX_FILE_UPLOAD_MB * 1024 * 1024;

export const safeFetch = async (url: string, init?: RequestInit) => {
  if (isTauri()) return tauriHttpFetch(url, init);
  return fetch(url, init);
};

export const readFileWithSizeGuard = async (filePath: string, fileName: string): Promise<Uint8Array<ArrayBuffer>> => {
  if (!isTauri()) throw new Error(`Upload de arquivo não disponível na versão web. Use o aplicativo desktop para enviar arquivos.`);
  const bytes = await tauriReadFile(filePath);
  if (bytes.length > MAX_FILE_UPLOAD_BYTES) {
    throw new Error(
      `Arquivo "${fileName}" excede o limite de ${MAX_FILE_UPLOAD_MB}MB ` +
      `(${(bytes.length / 1024 / 1024).toFixed(1)}MB). Reduza o tamanho do arquivo.`
    );
  }
  return bytes;
};

/**
 * Convert an ArrayBuffer to a base64 string using chunked processing.
 * Unlike btoa(reduce(...)), this is O(n) and handles large files without crashing.
 */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

/**
 * Convert a base64 string back to a Uint8Array.
 */
export const base64ToUint8Array = (b64: string): Uint8Array => {
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};
