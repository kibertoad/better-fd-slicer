export class ETOOBigError extends Error {
  code: string;

  constructor() {
    super('maximum file length exceeded');

    this.code = 'ETOOBIG';
  }
}
