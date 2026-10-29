export class RefreshBusyError extends Error {
  constructor() {
    super('Ya hay una actualización en curso para este proveedor.');
    this.name = 'RefreshBusyError';
    this.code = 'refresh_busy';
  }
}
