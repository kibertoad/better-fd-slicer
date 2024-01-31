import { EventEmitter } from 'events';
import {
  type BufferSlicerCreateReadOptions,
  BufferSlicerReadStream,
} from './buffer-slicer-read-stream';
import {
  BufferSlicerWriteStream,
  type BufferSlicerWriteStreamOptions,
} from './buffer-slicer-write-stream';

export interface BufferSliceOptions {
  maxChunkSize?: number;
}

export class BufferSlicer extends EventEmitter {
  refCount: number;
  buffer: Buffer;
  maxChunkSize: number;

  constructor(buffer: Buffer, options?: BufferSliceOptions) {
    super();

    this.refCount = 0;
    this.buffer = buffer;
    this.maxChunkSize = options?.maxChunkSize || Number.MAX_SAFE_INTEGER;
  }

  public read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: (error: Error | null, written: number) => void,
  ) {
    const end = position + length;
    const delta = end - this.buffer.length;
    const written = delta > 0 ? delta : length;

    this.buffer.copy(buffer, offset, position, end);

    setImmediate(() => {
      callback(null, written);
    });
  }

  public write(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: (error: Error | null, length: number, buffer: Buffer) => void,
  ) {
    buffer.copy(this.buffer, position, offset, offset + length);

    setImmediate(() => {
      callback(null, length, buffer);
    });
  }

  public createReadStream(
    options?: BufferSlicerCreateReadOptions,
  ): BufferSlicerReadStream {
    return new BufferSlicerReadStream(this, options);
  }

  public createWriteStream(
    options?: BufferSlicerWriteStreamOptions,
  ): BufferSlicerWriteStream {
    return new BufferSlicerWriteStream(this, options);
  }

  public ref(): void {
    this.refCount += 1;
  }

  public unref(): void {
    this.refCount -= 1;

    if (this.refCount < 0) {
      throw new Error('invalid unref');
    }
  }
}
