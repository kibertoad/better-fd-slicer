import { Writable, type WritableOptions } from 'node:stream';
import { BufferSlicer } from './buffer-slicer';
import { ETOOBigError } from './errors';

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

  constructor(
    bufferSlicer: BufferSlicer,
    options?: BufferSlicerWriteStreamOptions,
  ) {
    options = options || {};
    options.autoDestroy = true;

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
