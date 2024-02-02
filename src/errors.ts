/**
 * When the file is too big.
 */
export class ETOOBigError extends Error {
  code: string;

  constructor() {
    super('maximum file length exceeded');

    this.code = 'ETOOBIG';
  }
}

/**
 * When unref is called with refCount equal to/lower to 0.
 */
export class EInvalidUnref extends Error {
  code: string;

  constructor() {
    super('cannot unref when refCount equal or lower than 0');

    this.code = 'EINVALIDUNREF';
  }
}

/**
 * When the callback is called twice.
 */
export class EReleasedTwice extends Error {
  code: string;

  constructor() {
    super('release callback called twice');

    this.code = 'ERELEASEDTWICE';
  }
}
