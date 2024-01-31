import { type BufferSliceOptions, BufferSlicer } from './buffer-slicer';
import { FdSlicer, type FdSlicerOptions } from './fd-slicer';

export function createFromBuffer(
  buffer: Buffer,
  options?: BufferSliceOptions,
): BufferSlicer {
  return new BufferSlicer(buffer, options);
}

export function createFromFd(fd: number, options?: FdSlicerOptions): FdSlicer {
  return new FdSlicer(fd, options);
}
