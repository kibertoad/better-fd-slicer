import { EventEmitter } from 'events';
import fs from 'node:fs';
import Pend from 'pend';
import { EInvalidUnref } from './errors';
import { ReadStream, type ReadStreamOptions } from './read-stream';
import { WriteStream, type WriteStreamOptions } from './write-stream';

/**
 * Options to create {@link FdSlicer}.
 */
export interface FdSlicerOptions {
  /**
   * if set to true, the file descriptor will be automatically closed once the last stream that references it is closed.
   *
   * {@link FdSlicer.ref} and {@link FdSlicer.unref} can be used to increase or decrease the reference count, respectively.
   *
   * @default false
   */
  autoClose?: boolean;
}

/**
 * Create multiple readable and writable stream of a file descriptor.
 */
export class FdSlicer extends EventEmitter {
  /**
   * The file descriptor that this FdSlicer is reading/writing.
   */
  public readonly fd: number;

  /**
   * The number of streams that are currently using this FdSlicer.
   */
  public refCount: number;

  /**
   * See more {@link FdSlicerOptions.autoClose}.
   */
  public readonly autoClose: boolean;

  /**
   * The concurrency protection.
   */
  public readonly pend: Pend;

  constructor(fd: number, options?: FdSlicerOptions) {
    super();

    options = options || {};
    this.fd = fd;
    this.pend = new Pend();
    this.pend.max = 1;
    this.refCount = 0;
    this.autoClose = !!options.autoClose;
  }

  /**
   * Read from the file descriptor.
   *
   * Equivalent to fs.read, but with concurrency protection.
   *
   * @param buffer The buffer to write to.
   * @param offset The offset to start writing at.
   * @param length The number of bytes to read.
   * @param position The offset from the beginning of the file to start reading from.
   * @param callback The callback that will be called when the read is completed.
   */
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

  /**
   * Write to the file descriptor.
   *
   * Equivalent to fs.write, but with concurrency protection.
   *
   * @param buffer The buffer to write to.
   * @param offset The offset to start writing at.
   * @param length The number of bytes to write.
   * @param position The offset from the beginning of the file to start writing at.
   * @param callback The callback that will be called when the write is completed.
   */
  public write(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
    callback: (
      error: Error | null,
      bytesWritten: number,
      buffer: Buffer,
    ) => void,
  ) {
    this.pend.go(cb => {
      fs.write(
        this.fd,
        buffer,
        offset,
        length,
        position,
        (err, bytesWritten, buffer) => {
          cb();
          callback(err, bytesWritten, buffer);
        },
      );
    });
  }

  /**
   * Create a readable stream of the file descriptor.
   *
   * @param options Options for the stream.
   */
  public createReadStream(options?: ReadStreamOptions): ReadStream {
    return new ReadStream(this, options);
  }

  /**
   * Create a writable stream of the file descriptor.
   *
   * @param options Options for the stream.
   */
  public createWriteStream(options?: WriteStreamOptions): WriteStream {
    return new WriteStream(this, options);
  }

  /**
   * Increase the {@link FdSlicer.refCount} reference count by 1.
   *
   * See more {@link FdSlicerOptions.autoClose}.
   */
  public ref() {
    this.refCount += 1;
  }

  /**
   * Decrease the {@link FdSlicer.refCount} reference count by 1.
   *
   * See more {@link FdSlicerOptions.autoClose}.
   */
  public unref() {
    this.refCount -= 1;

    if (this.refCount > 0) return;
    if (this.refCount < 0) throw new EInvalidUnref();

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
