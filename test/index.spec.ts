import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Pend from 'pend';
import streamEqual from 'stream-equal';
import StreamSink from 'streamsink';
import { beforeAll, beforeEach, describe, it } from 'vitest';
import { ETOOBigError, createFromBuffer, createFromFd } from '../';

const testBlobFile = path.join(__dirname, 'test-blob.bin');
const testBlobFileSize = 20 * 1024 * 1024;
const testOutBlobFile = path.join(__dirname, 'test-blob-out.bin');

describe.sequential('FdSlicer', () => {
  beforeAll(async () => {
    const out = fs.createWriteStream(testBlobFile);

    for (let i = 0; i < testBlobFileSize / 1024; i += 1) {
      out.write(crypto.pseudoRandomBytes(1024));
    }

    out.end();
    await new Promise(r => out.on('close', r));

    return () => {
      try {
        fs.unlinkSync(testBlobFile);
        fs.unlinkSync(testOutBlobFile);
      } catch (err) {}
    };
  });

  beforeEach(() => {
    try {
      fs.unlinkSync(testOutBlobFile);
    } catch (err) {}
  });

  it('reads a 20MB file (autoClose on)', async () => {
    const fd = fs.openSync(testBlobFile, 'r');

    const slicer = createFromFd(fd, { autoClose: true });
    const actualStream = slicer.createReadStream();
    const expectedStream = fs.createReadStream(testBlobFile);

    await new Promise<void>((resolve, reject) => {
      const pend = new Pend();

      pend.go(cb => {
        slicer.on('close', cb);
      });

      pend.go(cb => {
        streamEqual(expectedStream, actualStream)
          .then(equal => {
            assert.ok(equal);

            cb();
          })
          .catch(reject);
      });

      pend.wait(resolve);
    });
  });

  it('reads 4 chunks simultaneously', async () => {
    const fd = fs.openSync(testBlobFile, 'r');

    const slicer = createFromFd(fd);
    const actualPart1 = slicer.createReadStream({
      start: (testBlobFileSize * 0) / 4,
      end: (testBlobFileSize * 1) / 4,
    });
    const actualPart2 = slicer.createReadStream({
      start: (testBlobFileSize * 1) / 4,
      end: (testBlobFileSize * 2) / 4,
    });
    const actualPart3 = slicer.createReadStream({
      start: (testBlobFileSize * 2) / 4,
      end: (testBlobFileSize * 3) / 4,
    });
    const actualPart4 = slicer.createReadStream({
      start: (testBlobFileSize * 3) / 4,
      end: (testBlobFileSize * 4) / 4,
    });

    const expectedPart1 = slicer.createReadStream({
      start: (testBlobFileSize * 0) / 4,
      end: (testBlobFileSize * 1) / 4,
    });
    const expectedPart2 = slicer.createReadStream({
      start: (testBlobFileSize * 1) / 4,
      end: (testBlobFileSize * 2) / 4,
    });
    const expectedPart3 = slicer.createReadStream({
      start: (testBlobFileSize * 2) / 4,
      end: (testBlobFileSize * 3) / 4,
    });
    const expectedPart4 = slicer.createReadStream({
      start: (testBlobFileSize * 3) / 4,
      end: (testBlobFileSize * 4) / 4,
    });

    await new Promise<void>((resolve, reject) => {
      const pend = new Pend();
      pend.go(cb => {
        streamEqual(expectedPart1, actualPart1)
          .then(equal => {
            assert.ok(equal);
            cb();
          })
          .catch(reject);
      });
      pend.go(cb => {
        streamEqual(expectedPart2, actualPart2)
          .then(equal => {
            assert.ok(equal);
            cb();
          })
          .catch(reject);
      });
      pend.go(cb => {
        streamEqual(expectedPart3, actualPart3)
          .then(equal => {
            assert.ok(equal);
            cb();
          })
          .catch(reject);
      });
      pend.go(cb => {
        streamEqual(expectedPart4, actualPart4)
          .then(equal => {
            assert.ok(equal);
            cb();
          })
          .catch(reject);
      });
      pend.wait(err => {
        if (err) return reject(err);

        try {
          fs.closeSync(fd);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });

  it('writes a 20MB file (autoClose on)', async () => {
    const fd = fs.openSync(testOutBlobFile, 'w');
    const slicer = createFromFd(fd, { autoClose: true });
    const actualStream = slicer.createWriteStream();
    const inStream = fs.createReadStream(testBlobFile);

    await new Promise<void>((resolve, reject) => {
      slicer.on('close', () => {
        const expected = fs.createReadStream(testBlobFile);
        const actual = fs.createReadStream(testOutBlobFile);

        streamEqual(expected, actual)
          .then(equal => {
            try {
              assert.ok(equal);

              resolve();
            } catch (e) {
              reject(e);
            }
          })
          .catch(reject);
      });
      inStream.pipe(actualStream);
    });
  });

  it('writes 4 chunks simultaneously', async () => {
    const fd = fs.openSync(testOutBlobFile, 'w');

    const slicer = createFromFd(fd);
    const actualPart1 = slicer.createWriteStream({
      start: (testBlobFileSize * 0) / 4,
    });
    const actualPart2 = slicer.createWriteStream({
      start: (testBlobFileSize * 1) / 4,
    });
    const actualPart3 = slicer.createWriteStream({
      start: (testBlobFileSize * 2) / 4,
    });
    const actualPart4 = slicer.createWriteStream({
      start: (testBlobFileSize * 3) / 4,
    });
    const in1 = fs.createReadStream(testBlobFile, {
      start: (testBlobFileSize * 0) / 4,
      end: (testBlobFileSize * 1) / 4,
    });
    const in2 = fs.createReadStream(testBlobFile, {
      start: (testBlobFileSize * 1) / 4,
      end: (testBlobFileSize * 2) / 4,
    });
    const in3 = fs.createReadStream(testBlobFile, {
      start: (testBlobFileSize * 2) / 4,
      end: (testBlobFileSize * 3) / 4,
    });
    const in4 = fs.createReadStream(testBlobFile, {
      start: (testBlobFileSize * 3) / 4,
      end: (testBlobFileSize * 4) / 4,
    });

    const pend = new Pend();
    pend.go(cb => {
      actualPart1.on('finish', cb);
    });
    pend.go(cb => {
      actualPart2.on('finish', cb);
    });
    pend.go(cb => {
      actualPart3.on('finish', cb);
    });
    pend.go(cb => {
      actualPart4.on('finish', cb);
    });

    in1.pipe(actualPart1);
    in2.pipe(actualPart2);
    in3.pipe(actualPart3);
    in4.pipe(actualPart4);

    await new Promise<void>((resolve, reject) => {
      pend.wait(() => {
        try {
          fs.closeSync(fd);
        } catch (e) {
          reject(e);
        }

        const expected = fs.createReadStream(testBlobFile);
        const actual = fs.createReadStream(testOutBlobFile);

        streamEqual(expected, actual)
          .then(equal => {
            try {
              assert.ok(equal);
              resolve();
            } catch (e) {
              reject(e);
            }
          })
          .catch(reject);
      });
    });
  });

  it('throws on invalid ref', () => {
    const fd = fs.openSync(testOutBlobFile, 'w');

    const slicer = createFromFd(fd, { autoClose: true });

    assert.throws(() => {
      slicer.unref();
    }, /invalid unref/);

    fs.closeSync(fd);
  });

  it('write stream emits error when max size exceeded', async () => {
    const fd = fs.openSync(testOutBlobFile, 'w');

    const slicer = createFromFd(fd, { autoClose: true });
    const ws = slicer.createWriteStream({ start: 0, end: 1000 });

    await new Promise<void>((resolve, reject) => {
      ws.on('error', (err: ETOOBigError) => {
        try {
          assert.strictEqual(err.code, 'ETOOBIG');
          slicer.on('close', resolve);
        } catch (e) {
          reject(e);
        }
      });
      ws.end(Buffer.alloc(1001));
    });
  });

  it('write stream does not emit error when max size not exceeded', async () => {
    const fd = fs.openSync(testOutBlobFile, 'w');

    const slicer = createFromFd(fd, { autoClose: true });
    const ws = slicer.createWriteStream({ end: 1000 });

    await new Promise<void>(resolve => {
      slicer.on('close', resolve);
      ws.end(Buffer.alloc(1000));
    });
  });

  it('write stream start and end work together', async () => {
    const fd = fs.openSync(testOutBlobFile, 'w');

    const slicer = createFromFd(fd, { autoClose: true });
    const ws = slicer.createWriteStream({ start: 1, end: 1000 });

    await new Promise<void>((resolve, reject) => {
      ws.on('error', (err: ETOOBigError) => {
        try {
          assert.strictEqual(err.code, 'ETOOBIG');
          slicer.on('close', resolve);
        } catch (e) {
          reject(e);
        }
      });
      ws.end(Buffer.alloc(1000));
    });
  });

  it('write stream emits progress events', async () => {
    const fd = fs.openSync(testOutBlobFile, 'w');

    const slicer = createFromFd(fd, { autoClose: true });
    const ws = slicer.createWriteStream();

    let progressEventCount = 0;
    let prevBytesWritten = 0;

    ws.on('progress', () => {
      progressEventCount += 1;
      assert.ok(ws.bytesWritten > prevBytesWritten);
      prevBytesWritten = ws.bytesWritten;
    });

    await new Promise<void>((resolve, reject) => {
      slicer.on('close', () => {
        try {
          assert.ok(progressEventCount > 5);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      for (let i = 0; i < 10; i += 1) {
        ws.write(Buffer.alloc(16 * 1024 * 2));
      }

      ws.end();
    });
  });

  it('write stream unrefs when destroyed', async () => {
    const fd = fs.openSync(testOutBlobFile, 'w');

    await new Promise<void>(resolve => {
      const slicer = createFromFd(fd, { autoClose: true });
      const ws = slicer.createWriteStream();

      slicer.on('close', resolve);
      ws.write(Buffer.alloc(1000));
      ws.destroy();
    });
  });

  it('read stream unrefs when destroyed', async () => {
    const fd = fs.openSync(testBlobFile, 'r');

    const slicer = createFromFd(fd, { autoClose: true });
    const rs = slicer.createReadStream();

    await new Promise<void>(resolve => {
      slicer.on('close', resolve);
      rs.destroy();
    });
  });

  it('fdSlicer.read', async () => {
    const fd = fs.openSync(testBlobFile, 'r');

    const slicer = createFromFd(fd);
    const outBuf = Buffer.alloc(1024);

    await new Promise<void>((resolve, reject) => {
      slicer.read(outBuf, 0, 10, 0, (err, bytesRead, buf) => {
        if (err) return reject(err);

        try {
          assert.strictEqual(bytesRead, 10);
          assert.strictEqual(Buffer.byteLength(buf), 1024);

          fs.closeSync(fd);

          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });

  it('fdSlicer.write', async () => {
    const fd = fs.openSync(testOutBlobFile, 'w');

    const slicer = createFromFd(fd);

    await new Promise<void>((resolve, reject) => {
      slicer.write(Buffer.from('blah\n'), 0, 5, 0, e => {
        if (e) return reject(e);

        fs.closeSync(fd);
        resolve();
      });
    });
  });
});

describe.sequential('BufferSlicer', () => {
  it('invalid ref', () => {
    const slicer = createFromBuffer(Buffer.alloc(16));

    slicer.ref();
    slicer.unref();

    assert.throws(() => {
      slicer.unref();
    }, /invalid unref/);
  });

  it('read and write', async () => {
    const buf = Buffer.from(
      'through the tangled thread the needle finds its way',
    );
    const slicer = createFromBuffer(buf);
    const outBuf = Buffer.alloc(1024);

    await new Promise<void>((resolve, reject) => {
      slicer.read(outBuf, 10, 11, 8, err => {
        if (err) return reject(err);

        try {
          assert.strictEqual(outBuf.toString('utf8', 10, 21), 'the tangled');
        } catch (e) {
          reject(e);
        }

        slicer.write(Buffer.from('derp'), 0, 4, 7, err2 => {
          if (err2) return reject(err2);

          try {
            assert.strictEqual(buf.toString('utf8', 7, 19), 'derp tangled');
          } catch (e) {
            return reject(e);
          }

          resolve();
        });
      });
    });
  });

  it('createReadStream', async () => {
    const str = 'I never conquered rarely came, 16 just held such better days';

    const buf = Buffer.from(str);
    const slicer = createFromBuffer(buf);
    const inStream = slicer.createReadStream();

    const sink = new StreamSink();

    inStream.pipe(sink);

    await new Promise<void>((resolve, reject) => {
      sink.on('finish', () => {
        try {
          assert.strictEqual(sink.toString(), str);
          inStream.destroy();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });

  it('createWriteStream exceed buffer size', async () => {
    const slicer = createFromBuffer(Buffer.alloc(4));
    const outStream = slicer.createWriteStream();

    await new Promise<void>((resolve, reject) => {
      outStream.on('error', (err: ETOOBigError) => {
        try {
          assert.strictEqual(err.code, 'ETOOBIG');
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      outStream.write('hi!\n');
      outStream.write('it warked\n');
      outStream.end();
    });
  });

  it('createWriteStream ok', async () => {
    const buf = Buffer.alloc(1024);
    const slicer = createFromBuffer(buf);
    const outStream = slicer.createWriteStream();

    await new Promise<void>((resolve, reject) => {
      outStream.on('finish', () => {
        try {
          assert.strictEqual(
            buf.toString('utf8', 0, 'hi!\nit warked\n'.length),
            'hi!\nit warked\n',
          );
          outStream.destroy();
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      outStream.write('hi!\n');
      outStream.write('it warked\n');
      outStream.end();
    });
  });
});
