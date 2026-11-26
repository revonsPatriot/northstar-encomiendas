import { UnpaidShipmentError } from '../errors/unpaid-shipment.error';

export enum ShipmentStatus {
  REGISTRADO = 'REGISTRADO',
  EN_TRANSITO = 'EN_TRANSITO',
  EN_SUCURSAL_DESTINO = 'EN_SUCURSAL_DESTINO',
  ENTREGADO = 'ENTREGADO',
  ANULADO = 'ANULADO',
}

export enum PaymentType {
  PAGADO_ORIGEN = 'PAGADO_ORIGEN',
  POR_PAGAR = 'POR_PAGAR',
  CUENTA_CORPORATIVA = 'CUENTA_CORPORATIVA',
}

export class InvalidShipmentTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidShipmentTransitionError';
  }
}

export interface ShipmentProps {
  id: string;
  guideNumber: string;
  status: ShipmentStatus;
  paymentType: PaymentType;
  isPaid: boolean;
}

export class ShipmentEntity {
  private status: ShipmentStatus;
  private isPaid: boolean;

  constructor(private readonly props: ShipmentProps) {
    this.status = props.status;
    this.isPaid = props.isPaid;
  }

  get guideNumber(): string {
    return this.props.guideNumber;
  }

  get currentStatus(): ShipmentStatus {
    return this.status;
  }

  get paymentType(): PaymentType {
    return this.props.paymentType;
  }

  get paid(): boolean {
    return this.isPaid;
  }

  /** Salida desde la sucursal de origen hacia el destino. */
  dispatch(): void {
    if (this.status !== ShipmentStatus.REGISTRADO) {
      throw new InvalidShipmentTransitionError(
        `No se puede despachar una guía en estado ${this.status}.`,
      );
    }
    this.status = ShipmentStatus.EN_TRANSITO;
  }

  arrive(): void {
    if (
      this.status !== ShipmentStatus.REGISTRADO &&
      this.status !== ShipmentStatus.EN_TRANSITO
    ) {
      throw new InvalidShipmentTransitionError(
        `No se puede registrar el arribo desde el estado ${this.status}.`,
      );
    }

    this.status = ShipmentStatus.EN_SUCURSAL_DESTINO;
  }

  deliver(): void {
    if (this.status !== ShipmentStatus.EN_SUCURSAL_DESTINO) {
      throw new InvalidShipmentTransitionError(
        `No se puede entregar una guía en estado ${this.status}.`,
      );
    }

    if (this.paymentType === PaymentType.POR_PAGAR && !this.isPaid) {
      throw new UnpaidShipmentError();
    }

    this.status = ShipmentStatus.ENTREGADO;
  }

  cancel(): void {
    if (
      this.status !== ShipmentStatus.REGISTRADO &&
      this.status !== ShipmentStatus.EN_TRANSITO
    ) {
      throw new InvalidShipmentTransitionError(
        `No se puede anular una guía en estado ${this.status}.`,
      );
    }
    this.status = ShipmentStatus.ANULADO;
  }

  /** Marca la guía como cobrada. Devuelve true si el cobro fue nuevo. */
  registerPayment(): boolean {
    if (this.isPaid) return false;
    this.isPaid = true;
    return true;
  }
}
