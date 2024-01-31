import fs from 'node:fs';
import { Readable, type ReadableOptions } from 'node:stream';
import { FdSlicer } from './fd-slicer';

export interface ReadStreamOptions extends ReadableOptions {
  start?: number;
  end?: number;
}

export class ReadStream extends Readable {
  context: FdSlicer;
  start: number;
  endOffset?: number;
  pos: number;

  constructor(context: FdSlicer, options?: ReadStreamOptions) {
    options = options || {};
    options.autoDestroy = true;

    super(options);

    this.context = context;
    this.context.ref();

    this.start = options.start || 0;
    this.endOffset = options.end;
    this.pos = this.start;
  }

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

    this.context.pend.go(cb => {
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

  public override _destroy(
    err: Error | null,
    callback: (error: Error | null) => void,
  ): void {
    this.context.unref();

    callback(err);
  }
}
