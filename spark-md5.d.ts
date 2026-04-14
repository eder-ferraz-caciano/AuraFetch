declare module 'spark-md5' {
  export class ArrayBuffer {
    append(data: string | ArrayBuffer): ArrayBuffer;
    end(): string;
    destroy(): void;
    static hash(data: string | ArrayBuffer): string;
  }
  
  export function hash(data: string | ArrayBuffer): string;
}
