import { PassThrough } from 'node:stream';
import type { TransformOptions } from 'stream';
import { BufferSlicer } from './buffer-slicer';

/**
 * Options to create {@link BufferSlicerReadStream}.
 *
 * For more details, see {@link https://nodejs.org/api/stream.html#new-streamwritableoptions stream.Writable} and {@link https://nodejs.org/api/stream.html#new-streamreadableoptions stream.Readable}.
 */
export interface BufferSlicerCreateReadOptions extends TransformOptions {
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
 * Represents a readable stream of a buffer.
 */
export class BufferSlicerReadStream extends PassThrough {
  /**
   * See more {@link BufferSlicerCreateReadOptions.start}.
   */
  public readonly start: number;
  /**
   * See more {@link BufferSlicerCreateReadOptions.end}.
   */
  public readonly endOffset?: number;
  /**
   * Exclusive upper bound offset into the file to stop reading from.
   *
   * Defaults to {@link BufferSlicer.buffer} length.
   */
  public readonly pos: number;

  constructor(
    bufferSlicer: BufferSlicer,
    options?: BufferSlicerCreateReadOptions,
  ) {
    options = options || {};

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
