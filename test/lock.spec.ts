import { describe, expect, it } from 'vitest';
import { EReleasedTwice } from '../src';
import { Lock } from '../src/lock';

describe('lock', () => {
  it('should be able to lock and release', async () => {
    const lock = new Lock();

    expect(lock.pending).toBe(0);

    await new Promise<void>((resolve, reject) => {
      lock.acquire((release) => {
        try {
          expect(lock.pending).toBe(1);

          release();

          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });

    expect(lock.pending).toBe(0);
  });

  it('should be able to lock twice with 1 max concurrency', async () => {
    const lock = new Lock(1);
    const results: number[] = [];

    await new Promise<void>((resolve) => {
      lock.acquire((release) => {
        results.push(1);
        setTimeout(release, 20);
      });

      lock.acquire((release) => {
        results.push(2);
        release();
        resolve();
      });
    });

    expect(lock.pending).toBe(0);
    expect(results).toStrictEqual([1, 2]);
  });

  it('wait callback should be called when all locks are released', async () => {
    const lock = new Lock();
    const results: number[] = [];

    await new Promise<void>((resolve) => {
      lock.acquire((release) => {
        results.push(1);
        setTimeout(release, 20);
      });

      lock.acquire((release) => {
        results.push(2);
        release();
      });

      lock.wait(() => {
        results.push(3);
        resolve();
      });
    });

    expect(lock.pending).toBe(0);
    expect(results).toStrictEqual([1, 2, 3]);
  });

  it('should be able to lock and release with error', async () => {
    const lock = new Lock();

    await new Promise<void>((resolve) => {
      lock.acquire((release) => {
        release(new Error('bla'));
        resolve();
      });
    });

    expect(lock.pending).toBe(0);
    expect(lock.error).toHaveProperty('message', 'bla');
  });

  it('release error should be propagated to wait', async () => {
    const lock = new Lock();

    await new Promise<void>((resolve, reject) => {
      lock.acquire((release) => {
        setTimeout(() => release(new Error('bla')), 20);
      });

      lock.wait((err) => {
        try {
          expect(err?.message).toBe('bla');
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });

    expect(lock.pending).toBe(0);
  });

  it('release error should store the first error only', async () => {
    const lock = new Lock();

    await new Promise<void>((resolve) => {
      lock.acquire((release) => {
        release(new Error('bla'));
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      lock.acquire((release) => {
        release(new Error('buu'));
        resolve();
      });
    });

    expect(lock.pending).toBe(0);
    expect(lock.error).toHaveProperty('message', 'bla');
  });

  it('should throw error if release is called twice', async () => {
    const lock = new Lock();

    await new Promise<void>((resolve, reject) => {
      lock.acquire((release) => {
        try {
          release();
          release();
        } catch (e) {
          try {
            expect(e).toBeInstanceOf(EReleasedTwice);
            resolve();
          } catch (ex) {
            reject(ex);
          }
        }
      });
    });
  });
});
