declare module 'spark-md5' {
  interface ArrayBufferHasher {
    append(data: string | ArrayBuffer): ArrayBufferHasher;
    end(): string;
    destroy(): void;
  }
  
  export class ArrayBuffer {
    static hash(data: string | Uint8Array): string;
  }
  
  export function hash(data: string): string;
}
