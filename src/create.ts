import { type BufferSliceOptions, BufferSlicer } from './buffer-slicer';
import { FdSlicer, type FdSlicerOptions } from './fd-slicer';

/**
 * Create a new BufferSlicer from a buffer.
 *
 * @param buffer The buffer to slice
 * @param options Options for the BufferSlicer
 */
export function createFromBuffer(
  buffer: Buffer,
  options?: BufferSliceOptions,
): BufferSlicer {
  return new BufferSlicer(buffer, options);
}

/**
 * Make sure fd is a properly initialized file descriptor.
 *
 * If you want to use createReadStream make sure you open it for reading and if you want to use createWriteStream make sure you open it for writing.
 *
 * @param fd The file descriptor
 * @param options Options for the FdSlicer
 */
export function createFromFd(fd: number, options?: FdSlicerOptions): FdSlicer {
  return new FdSlicer(fd, options);
}
