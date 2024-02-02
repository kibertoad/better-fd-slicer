import { EventEmitter } from 'events';
import {
  type BufferSlicerCreateReadOptions,
  BufferSlicerReadStream,
} from './buffer-slicer-read-stream';
import {
  BufferSlicerWriteStream,
  type BufferSlicerWriteStreamOptions,
} from './buffer-slicer-write-stream';
import { EInvalidUnref } from './errors';

/**
 * Options to create {@link BufferSlicer}.
 */
export interface BufferSliceOptions {
  /**
   * A Number of bytes.
   *
   * See more details at {@link BufferSlicer.createReadStream}.
   *
   * If falsey, defaults to unlimited.
   */
  maxChunkSize?: number;
}

/**
 * Create multiple readable and writable stream of a buffer.
 */
export class BufferSlicer extends EventEmitter {
  /**
   * The number of streams that are currently using this BufferSlicer.
   */
  public refCount: number;
  /**
   * The buffer that this BufferSlicer is reading/writing.
   */
  public readonly buffer: Buffer;
  /**
   * See more {@link BufferSliceOptions.maxChunkSize}.
   */
  public readonly maxChunkSize: number;

  constructor(buffer: Buffer, options?: BufferSliceOptions) {
    super();

    this.refCount = 0;
    this.buffer = buffer;
    this.maxChunkSize = options?.maxChunkSize || Number.MAX_SAFE_INTEGER;
  }

  /**
   * Read from the {@link BufferSlicer.buffer}.
   *
   * Equivalent to fs.read, but with concurrency protection.
   *
   * @param buffer The buffer to write to.
   * @param offset The offset to start writing at.
   * @param length The number of bytes to read.
   * @param position The offset from the beginning of the file to start reading from.
   * @param callback The callback that will be called when the read is completed.
   */
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

  /**
   * Write to the {@link BufferSlicer.buffer}.
   *
   * Equivalent to fs.write, but with concurrency protection.
   *
   * @param buffer The buffer to write to.
   * @param offset The offset to start writing at.
   * @param length The number of bytes to write.
   * @param position The offset from the beginning of the file to start writing at.
   * @param callback The callback that will be called when the write is completed.
   */
  public write(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: (
      error: Error | null,
      bytesWritten: number,
      buffer: Buffer,
    ) => void,
  ) {
    buffer.copy(this.buffer, position, offset, offset + length);

    setImmediate(() => {
      callback(null, length, buffer);
    });
  }

  /**
   * Create a readable stream of the buffer.
   *
   * If maxChunkSize was specified (see createFromBuffer()), the read stream will provide chunks of at most that size.
   *
   * Normally, the read stream provides the entire range requested in a single chunk, but this can cause performance problems in some circumstances.
   *
   * See thejoshwolfe/yauzl#87.
   *
   * @param options Options for the read stream
   */
  public createReadStream(
    options?: BufferSlicerCreateReadOptions,
  ): BufferSlicerReadStream {
    return new BufferSlicerReadStream(this, options);
  }

  /**
   * Create a writable stream of the buffer.
   *
   * @param options Options for the write stream.
   */
  public createWriteStream(
    options?: BufferSlicerWriteStreamOptions,
  ): BufferSlicerWriteStream {
    return new BufferSlicerWriteStream(this, options);
  }

  /**
   * Increase the {@link BufferSlicer.refCount} reference count by 1.
   */
  public ref(): void {
    this.refCount += 1;
  }

  /**
   * Decrease the {@link BufferSlicer.refCount} reference count by 1.
   */
  public unref(): void {
    this.refCount -= 1;

    if (this.refCount < 0) {
      throw new EInvalidUnref();
    }
  }
}
