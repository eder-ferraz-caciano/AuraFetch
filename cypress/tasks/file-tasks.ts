import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const tempFiles: string[] = []

export function generateLargeFile({ sizeMb, name }: { sizeMb: number; name?: string }): string {
  const filePath = path.join(os.tmpdir(), name ?? `test-file-${sizeMb}mb-${Date.now()}.bin`)
  const buffer = Buffer.alloc(sizeMb * 1024 * 1024, 0)
  fs.writeFileSync(filePath, buffer)
  tempFiles.push(filePath)
  return filePath
}

export function cleanupTempFiles(): null {
  for (const f of tempFiles) {
    try { fs.unlinkSync(f) } catch { /* ignorar */ }
  }
  tempFiles.length = 0
  return null
}
