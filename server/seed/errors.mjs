export class SeedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SeedError';
  }
}
