import { PassThrough } from 'node:stream';
import type { TransformOptions } from 'stream';
import { BufferSlicer } from './buffer-slicer';

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
