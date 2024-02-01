import fs from 'node:fs';
import { Writable, type WritableOptions } from 'node:stream';
import { ETOOBigError } from './errors';
import { FdSlicer } from './fd-slicer';

/**
 * Options to create {@link WriteStream}.
 *
 * For more details, see {@link https://nodejs.org/api/stream.html#new-streamwritableoptions stream.Writable}.
 */
export interface WriteStreamOptions extends WritableOptions {
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
 * Represents a writable stream used to write to a file descriptor.
 *
 * For each chunk written, the stream will emit a 'progress' event.
 */
export class WriteStream extends Writable {
  /**
   * See more {@link WriteStreamOptions.start}.
   */
  public readonly start: number;

  /**
   * See more {@link WriteStreamOptions.end}.
   */
  public readonly endOffset: number;

  /**
   * The number of bytes written so far.
   */
  public bytesWritten: number;

  /**
   * The current position of the stream in the file descriptor.
   *
   * Defaults to {@link WriteStream.start}.
   */
  public pos: number;

  protected readonly context: FdSlicer;

  constructor(context: FdSlicer, options?: WriteStreamOptions) {
    options = options || {};
    super(options);

    this.context = context;
    this.context.ref();

    this.start = options.start || 0;
    this.endOffset = options.end == null ? Infinity : +options.end;
    this.bytesWritten = 0;
    this.pos = this.start;
  }

  /**
   * {@inheritDoc}
   */
  public override _write(
    buffer: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error) => void,
  ) {
    if (this.pos + buffer.length > this.endOffset) {
      const err = new ETOOBigError();

      callback(err);

      return;
    }

    this.context.pend.acquire(cb => {
      if (this.destroyed) return cb();
      fs.write(
        this.context.fd,
        buffer,
        0,
        buffer.length,
        this.pos,
        (err, bytes) => {
          if (err) {
            cb();
            callback(err);
          } else {
            this.bytesWritten += bytes;
            this.pos += bytes;
            this.emit('progress');

            cb();
            callback();
          }
        },
      );
    });
  }

  /**
   * {@inheritDoc}
   */
  public override _destroy(
    err: Error | null,
    callback: (error: Error | null) => void,
  ) {
    this.context.unref();

    callback(err);
  }
}
