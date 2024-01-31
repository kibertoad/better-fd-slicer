import fs from 'node:fs';
import { Writable, type WritableOptions } from 'node:stream';
import { ETOOBigError } from './errors';
import { FdSlicer } from './fd-slicer';

export interface WriteStreamOptions extends WritableOptions {
  start?: number;
  end?: number;
}

export class WriteStream extends Writable {
  context: FdSlicer;
  start: number;
  endOffset: number;
  bytesWritten: number;
  pos: number;

  constructor(context: FdSlicer, options?: WriteStreamOptions) {
    options = options || {};
    options.autoDestroy = true;
    super(options);

    this.context = context;
    this.context.ref();

    this.start = options.start || 0;
    this.endOffset = options.end == null ? Infinity : +options.end;
    this.bytesWritten = 0;
    this.pos = this.start;
  }

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

    this.context.pend.go(cb => {
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

  public override _destroy(
    err: Error | null,
    callback: (error: Error | null) => void,
  ) {
    this.context.unref();

    callback(err);
  }
}
