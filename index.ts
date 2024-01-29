import fs from 'node:fs';
import type {ReadableOptions, WritableOptions} from 'node:stream';
import {PassThrough, Readable, Writable} from 'node:stream';
import Pend from 'pend';
import {EventEmitter} from 'events';
import type {TransformOptions} from 'stream';

export interface FdSlicerOptions {
  autoClose?: boolean;
}

export class FdSlicer extends EventEmitter {
  fd: number;
  pend: Pend;
  refCount: number;
  autoClose: boolean;

  constructor(
    fd: number, options?: FdSlicerOptions,
  ) {
    super();

    options = options || {};
    this.fd = fd;
    this.pend = new Pend();
    this.pend.max = 1;
    this.refCount = 0;
    this.autoClose = !!options.autoClose;
  }

  public read(buffer: Buffer, offset: number, length: number, position: number, callback: (error: Error | null, bytesRead: number, buffer: Buffer) => void) {
    this.pend.go((cb) => {
      fs.read(this.fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
        cb();
        callback(err, bytesRead, buffer);
      });
    });
  }

  public write(buffer: Buffer, offset: number, length: number, position: number, callback: (error: Error | null, written: number, buffer: Buffer) => void) {
    this.pend.go((cb) => {
      fs.write(this.fd, buffer, offset, length, position, (err, written, buffer) => {
        cb();
        callback(err, written, buffer);
      });
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
      fs.close(this.fd, (err) => {
        if (err) {
          this.emit('error', err);
        } else {
          this.emit('close');
        }
      });
    }
  }
}

export interface ReadStreamOptions extends ReadableOptions {
  start?: number;
  end?: number;
}

export class ReadStream extends Readable {
  context: FdSlicer;
  start: number;
  endOffset?: number;
  pos: number;

  constructor(
    context: FdSlicer, options?: ReadStreamOptions,
  ) {
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

    this.context.pend.go((cb) => {
      if (this.destroyed) return cb();

      const buffer = Buffer.alloc(toRead);

      fs.read(this.context.fd, buffer, 0, toRead, this.pos, (err, bytesRead) => {
        if (err) {
          this.destroy(err);
        } else if (bytesRead === 0) {
          this.push(null);
        } else {
          this.pos += bytesRead;
          this.push(buffer.slice(0, bytesRead));
        }

        cb();
      });
    });
  }

  public override _destroy(err: Error | null, callback: (error: Error | null) => void): void {
    this.context.unref();

    callback(err);
  }
}

export interface WriteStreamOptions extends WritableOptions {
  start?: number;
  end?: number;
}

export class ETOOBigError extends Error {
  code: string;

  constructor() {
    super('maximum file length exceeded');

    this.code = 'ETOOBIG';
  }
}

export class WriteStream extends Writable {
  context: FdSlicer;
  start: number;
  endOffset: number;
  bytesWritten: number;
  pos: number;

  constructor(
    context: FdSlicer, options?: WriteStreamOptions,
  ) {
    options = options || {};
    options.autoDestroy = true;
    super(options);

    this.context = context;
    this.context.ref();

    this.start = options.start || 0;
    this.endOffset = (options.end == null) ? Infinity : +options.end;
    this.bytesWritten = 0;
    this.pos = this.start;
  }

  public override _write(buffer: Buffer, _encoding: BufferEncoding, callback: (error?: Error) => void) {
    if (this.pos + buffer.length > this.endOffset) {
      const err = new ETOOBigError();

      callback(err);

      return;
    }

    this.context.pend.go((cb) => {
      if (this.destroyed) return cb();
      fs.write(this.context.fd, buffer, 0, buffer.length, this.pos, (err, bytes) => {
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
      });
    });
  }

  public override _destroy(err: Error | null, callback: (error: Error | null) => void) {
    this.context.unref();

    callback(err);
  }
}

export interface BufferSliceOptions {
  maxChunkSize?: number;
}

export interface BufferSlicerCreateReadOptions extends TransformOptions {
  start?: number;
  end?: number;
}

export class BufferSlicerReadStream extends PassThrough {
  start: number;
  endOffset?: number;
  pos: number;

  constructor(
    bufferSlicer: BufferSlicer,
    options?: BufferSlicerCreateReadOptions,
  ) {
    options = options || {};
    options.autoDestroy = true;

    super(options);

    this.start = options.start || 0;
    this.endOffset = options.end;
    // by the time this function returns, we'll be done.
    this.pos = this.endOffset || bufferSlicer.buffer.length;

    // respect the maxChunkSize option to slice up the chunk into smaller pieces.
    const entireSlice = bufferSlicer.buffer.slice(this.start, this.pos);
    let offset = 0;

    while (true) {
      const nextOffset = offset + bufferSlicer.maxChunkSize;
      if (nextOffset >= entireSlice.length) {
        // last chunk
        if (offset < entireSlice.length) {
          this.write(entireSlice.slice(offset, entireSlice.length));
        }
        break;
      }

      this.write(entireSlice.slice(offset, nextOffset));
      offset = nextOffset;
    }

    this.end();
  }
}

export interface BufferSlicerWriteStreamOptions extends WritableOptions {
  start?: number;
  end?: number;
}

export class BufferSlicerWriteStream extends Writable {
  bufferSlicer: BufferSlicer;
  start: number;
  endOffset: number;
  bytesWritten: number;
  pos: number;

  constructor(bufferSlicer: BufferSlicer, options?: BufferSlicerWriteStreamOptions) {
    options = options || {};
    options.autoDestroy = true;

    super(options);

    this.bufferSlicer = bufferSlicer;
    this.start = options.start || 0;
    this.endOffset = (options.end == null) ? this.bufferSlicer.buffer.length : +options.end;
    this.bytesWritten = 0;
    this.pos = this.start;
  }

  public override _write(buffer: Buffer, _encoding: BufferEncoding, callback: (error?: Error) => void) {
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

  public read(buffer: Buffer, offset: number, length: number, position: number, callback: (error: Error | null, written: number) => void) {
    const end = position + length;
    const delta = end - this.buffer.length;
    const written = (delta > 0) ? delta : length;

    this.buffer.copy(buffer, offset, position, end);

    setImmediate(() => {
      callback(null, written);
    });
  }

  public write(buffer: Buffer, offset: number, length: number, position: number, callback: (error: Error | null, length: number, buffer: Buffer) => void) {
    buffer.copy(this.buffer, position, offset, offset + length);

    setImmediate(() => {
      callback(null, length, buffer);
    });
  }

  public createReadStream(options?: BufferSlicerCreateReadOptions): BufferSlicerReadStream {
    return new BufferSlicerReadStream(this, options);
  }

  public createWriteStream(options?: BufferSlicerWriteStreamOptions): BufferSlicerWriteStream {
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

export function createFromBuffer(buffer: Buffer, options?: BufferSliceOptions): BufferSlicer {
  return new BufferSlicer(buffer, options);
}

export function createFromFd(fd: number, options?: FdSlicerOptions): FdSlicer {
  return new FdSlicer(fd, options);
}
