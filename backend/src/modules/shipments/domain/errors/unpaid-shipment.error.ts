export class UnpaidShipmentError extends Error {
  constructor() {
    super('La encomienda debe ser pagada antes de confirmar la entrega.');
    this.name = 'UnpaidShipmentError';
  }
}