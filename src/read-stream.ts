import fs from 'node:fs';
import { Readable, type ReadableOptions } from 'node:stream';
import { FdSlicer } from './fd-slicer';

/**
 * Options to create {@link ReadStream}.
 *
 * For more details, see {@link https://nodejs.org/api/stream.html#new-streamreadableoptions stream.Readable}.
 */
export interface ReadStreamOptions extends ReadableOptions {
  /**
   * The offset into the file to start reading from.
   *
   * @default 0
   */
  start?: number;

  /**
   * Exclusive upper bound offset into the file to stop reading from.
   */
  end?: number;
}

/**
 * Represents a readable stream of a file descriptor.
 */
export class ReadStream extends Readable {
  /**
   * See more {@link ReadStreamOptions.start}.
   */
  public readonly start: number;
  /**
   * See more {@link ReadStreamOptions.end}.
   */
  public readonly endOffset?: number;
  /**
   * The current position of the stream in the file descriptor.
   *
   * Defaults to {@link ReadStream.start}.
   */
  public pos: number;

  protected readonly context: FdSlicer;

  constructor(context: FdSlicer, options?: ReadStreamOptions) {
    options = options || {};

    super(options);

    this.context = context;
    this.context.ref();

    this.start = options.start || 0;
    this.endOffset = options.end;
    this.pos = this.start;
  }

  /**
   * {@inheritDoc}
   */
  public override _read(n: number) {
    if (this.destroyed) return;

    let toRead = n;

    if (this.endOffset != null) {
      toRead = Math.min(toRead, this.endOffset - this.pos);
    }
    if (toRead <= 0) {
      this.destroyed = true;
      this.push(null);
      this.context.unref();
      return;
    }

    this.context.pend.acquire((cb) => {
      if (this.destroyed) return cb();

      const buffer = Buffer.alloc(toRead);

      fs.read(
        this.context.fd,
        buffer,
        0,
        toRead,
        this.pos,
        (err, bytesRead) => {
          if (err) {
            this.destroy(err);
          } else if (bytesRead === 0) {
            this.push(null);
          } else {
            this.pos += bytesRead;
            this.push(buffer.slice(0, bytesRead));
          }

          cb();
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
  ): void {
    this.context.unref();

    callback(err);
  }
}
