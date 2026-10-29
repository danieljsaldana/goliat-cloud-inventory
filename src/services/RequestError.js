export class RequestError extends Error {
  constructor(status, code) {
    super(`HTTP ${status}`);
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
  }
}
