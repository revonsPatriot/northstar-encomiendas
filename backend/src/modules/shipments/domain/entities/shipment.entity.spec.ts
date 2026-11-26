import { UnpaidShipmentError } from '../errors/unpaid-shipment.error';
import {
  InvalidShipmentTransitionError,
  PaymentType,
  ShipmentEntity,
  ShipmentStatus,
} from './shipment.entity';

const build = (
  status: ShipmentStatus,
  paymentType = PaymentType.PAGADO_ORIGEN,
  isPaid = true,
) =>
  new ShipmentEntity({
    id: '1',
    guideNumber: '004154',
    status,
    paymentType,
    isPaid,
  });

describe('ShipmentEntity', () => {
  it('sigue el flujo REGISTRADO -> EN_TRANSITO -> DESTINO -> ENTREGADO', () => {
    const shipment = build(ShipmentStatus.REGISTRADO);
    shipment.dispatch();
    expect(shipment.currentStatus).toBe(ShipmentStatus.EN_TRANSITO);
    shipment.arrive();
    expect(shipment.currentStatus).toBe(ShipmentStatus.EN_SUCURSAL_DESTINO);
    shipment.deliver();
    expect(shipment.currentStatus).toBe(ShipmentStatus.ENTREGADO);
  });

  it('no permite entregar una guía POR_PAGAR sin cobro', () => {
    const shipment = build(
      ShipmentStatus.EN_SUCURSAL_DESTINO,
      PaymentType.POR_PAGAR,
      false,
    );
    expect(() => shipment.deliver()).toThrow(UnpaidShipmentError);
  });

  it('permite entregar una guía POR_PAGAR luego de registrar el cobro', () => {
    const shipment = build(
      ShipmentStatus.EN_SUCURSAL_DESTINO,
      PaymentType.POR_PAGAR,
      false,
    );
    expect(shipment.registerPayment()).toBe(true);
    expect(shipment.registerPayment()).toBe(false);
    shipment.deliver();
    expect(shipment.currentStatus).toBe(ShipmentStatus.ENTREGADO);
  });

  it('no permite entregar si no llegó a destino', () => {
    expect(() => build(ShipmentStatus.EN_TRANSITO).deliver()).toThrow(
      InvalidShipmentTransitionError,
    );
  });

  it('permite anular solo antes de llegar a destino', () => {
    const early = build(ShipmentStatus.EN_TRANSITO);
    early.cancel();
    expect(early.currentStatus).toBe(ShipmentStatus.ANULADO);
    expect(() => build(ShipmentStatus.ENTREGADO).cancel()).toThrow(
      InvalidShipmentTransitionError,
    );
    expect(() => build(ShipmentStatus.EN_SUCURSAL_DESTINO).cancel()).toThrow(
      InvalidShipmentTransitionError,
    );
  });

  it('no permite despachar dos veces', () => {
    expect(() => build(ShipmentStatus.EN_TRANSITO).dispatch()).toThrow(
      InvalidShipmentTransitionError,
    );
  });
});
