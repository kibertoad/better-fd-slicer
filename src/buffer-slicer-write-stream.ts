import { Writable, type WritableOptions } from 'node:stream';
import { BufferSlicer } from './buffer-slicer';
import { ETOOBigError } from './errors';

/**
 * Options to create {@link BufferSlicerWriteStream}.
 *
 * For more details, see {@link https://nodejs.org/api/stream.html#new-streamwritableoptions stream.Writable}.
 */
export interface BufferSlicerWriteStreamOptions extends WritableOptions {
  /**
   * The offset into the file to start writing to.
   *
   * @default 0
   */
  start?: number;

  /**
   * Exclusive upper bound offset into the file.
   *
   * If this offset is reached, the write stream will emit an 'error' event and stop functioning.
   *
   * In this situation, err.code === 'ETOOBIG'.
   *
   * @default Infinity
   */
  end?: number;
}

/**
 * Represents a writable stream of a buffer.
 *
 * For each chunk written, the stream will emit a 'progress' event.
 */
export class BufferSlicerWriteStream extends Writable {
  bufferSlicer: BufferSlicer;
  start: number;
  endOffset: number;
  bytesWritten: number;
  pos: number;

  constructor(
    bufferSlicer: BufferSlicer,
    options?: BufferSlicerWriteStreamOptions,
  ) {
    options = options || {};

    super(options);

    this.bufferSlicer = bufferSlicer;
    this.start = options.start || 0;
    this.endOffset =
      options.end == null ? this.bufferSlicer.buffer.length : +options.end;
    this.bytesWritten = 0;
    this.pos = this.start;
  }

  public override _write(
    buffer: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error) => void,
  ) {
    const end = this.pos + buffer.length;
    if (end > this.endOffset) {
      const err = new ETOOBigError();

      callback(err);
      return;
    }

    buffer.copy(this.bufferSlicer.buffer, this.pos, 0, buffer.length);

    this.bytesWritten += buffer.length;
    this.pos = end;
    this.emit('progress');

    callback();
  }
}
