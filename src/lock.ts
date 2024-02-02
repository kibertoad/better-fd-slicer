import { EReleasedTwice } from './errors';

/**
 * Use this callback to release the lock acquired and continue the next pending operation.
 */
export type ReleaseCallback = (err?: Error) => void;

/**
 * Use this callback to acquire the lock and run the operation.
 */
export type AcquireCallback = (release: ReleaseCallback) => void;

/**
 * Use this callback to wait for all pending locks to be released.
 */
export type WaitCallback = (err: Error | null) => void;

/**
 * A simple lock for managing concurrency.
 */
export class Lock {
  /**
   * The error passed to the release callback, if any.
   * @private
   */
  #error: Error | null = null;
  /**
   * The queue of pending operations.
   * @private
   */
  #waiting: AcquireCallback[] = [];
  /**
   * The queue of listeners waiting for all locks to be released.
   * @private
   */
  #listeners: WaitCallback[] = [];
  /**
   * The number of pending operations.
   * @private
   */
  #pending = 0;
  /**
   * The maximum number of concurrent operations.
   * @private
   */
  #max: number;

  /**
   * Create a new Pend instance.
   *
   * @param max The maximum number of concurrent operations.
   */
  constructor(max: number = Infinity) {
    this.#max = max;
  }

  /**
   * The number of pending operations.
   */
  public get pending() {
    return this.#pending;
  }

  /**
   * If there is an error passed to the release callback, then this will be set to that error.
   */
  public get error() {
    return this.#error;
  }

  /**
   * Acquire a resource, if the max concurrency has been reached, then the fn is queued.
   *
   * @param fn The function to run.
   */
  public acquire(fn: AcquireCallback): void {
    if (this.#pending < this.#max) {
      this.#run(fn);
    } else {
      this.#waiting.push(fn);
    }
  }

  /**
   * Wait for all pending operations to be released.
   *
   * If there are no pending operations, then the fn is called immediately.
   *
   * After pending is 0, the fn is called, and the listeners are cleared.
   *
   * @param fn The function to run.
   */
  public wait(fn: WaitCallback): void {
    if (this.#pending === 0) {
      setImmediate(() => {
        fn(null);
      });
      return;
    }

    this.#listeners.push(fn);
  }

  /**
   * Run actual or pending fn.
   *
   * @fn The function to run.
   * @private
   */
  #run(fn: AcquireCallback) {
    fn(this.#createRelease());
  }

  /**
   * Create the release function for a pending operation.
   *
   * @private
   */
  #createRelease(): ReleaseCallback {
    this.#pending += 1;

    let called = false;

    return (err?: Error) => {
      if (called) throw new EReleasedTwice();

      called = true;

      this.#error = this.#error || err || null;
      this.#pending -= 1;

      const nextCallback = this.#waiting.shift();

      if (nextCallback && this.#pending < this.#max) {
        this.#run(nextCallback);
      } else if (this.#pending === 0) {
        const listeners = this.#listeners;
        this.#listeners = [];

        for (const listener of listeners) {
          listener(this.#error);
        }
      }
    };
  }
}
