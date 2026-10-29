export class MigrationError extends Error {
  constructor(message, code = 'MIGRATION_BLOCKED') {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
  }
}
