import { EventEmitter } from 'events';
import fs from 'node:fs';
import Pend from 'pend';
import { ReadStream, type ReadStreamOptions } from './read-stream';
import { WriteStream, type WriteStreamOptions } from './write-stream';

export interface FdSlicerOptions {
  autoClose?: boolean;
}

export class FdSlicer extends EventEmitter {
  fd: number;
  pend: Pend;
  refCount: number;
  autoClose: boolean;

  constructor(fd: number, options?: FdSlicerOptions) {
    super();

    options = options || {};
    this.fd = fd;
    this.pend = new Pend();
    this.pend.max = 1;
    this.refCount = 0;
    this.autoClose = !!options.autoClose;
  }

  public read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: (error: Error | null, bytesRead: number, buffer: Buffer) => void,
  ) {
    this.pend.go(cb => {
      fs.read(
        this.fd,
        buffer,
        offset,
        length,
        position,
        (err, bytesRead, buffer) => {
          cb();
          callback(err, bytesRead, buffer);
        },
      );
    });
  }

  public write(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: (error: Error | null, written: number, buffer: Buffer) => void,
  ) {
    this.pend.go(cb => {
      fs.write(
        this.fd,
        buffer,
        offset,
        length,
        position,
        (err, written, buffer) => {
          cb();
          callback(err, written, buffer);
        },
      );
    });
  }

  public createReadStream(options?: ReadStreamOptions): ReadStream {
    return new ReadStream(this, options);
  }

  public createWriteStream(options?: WriteStreamOptions): WriteStream {
    return new WriteStream(this, options);
  }

  public ref() {
    this.refCount += 1;
  }

  public unref() {
    this.refCount -= 1;

    if (this.refCount > 0) return;
    if (this.refCount < 0) throw new Error('invalid unref');

    if (this.autoClose) {
      fs.close(this.fd, err => {
        if (err) {
          this.emit('error', err);
        } else {
          this.emit('close');
        }
      });
    }
  }
}
