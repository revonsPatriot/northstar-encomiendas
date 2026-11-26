import { PaymentType, ShipmentStatus } from '../entities/shipment.entity';

export interface CustomerInput {
  ciNit?: string;
  fullName: string;
  phone?: string;
}

export interface ShipmentItemInput {
  quantity: number;
  description: string;
  weightKg?: number;
  subtotal: number;
}

export interface Actor {
  userId: string;
  branchId: string;
  role: 'ADMIN_CENTRAL' | 'ENCARGADO_SUCURSAL' | 'OPERADOR';
}

export interface RegisterShipmentInput {
  originBranchId: string;
  destinationBranchId: string;
  sender: CustomerInput;
  consignee: CustomerInput;
  paymentType: PaymentType;
  totalAmount: number;
  items: ShipmentItemInput[];
  clientRequestId?: string;
  actor: Actor;
}

export interface ConfirmPickupInput {
  guideNumber: string;
  actor: Actor;
  receiverCi: string;
  notes?: string;
  payOnDelivery: boolean;
}

export interface ListShipmentsFilter {
  branchId: string;
  statuses?: ShipmentStatus[];
  query?: string;
  take?: number;
  skip?: number;
}

export interface ShipmentRepositoryPort {
  register(input: RegisterShipmentInput): Promise<unknown>;
  dispatch(guideNumber: string, actor: Actor): Promise<unknown>;
  arrive(guideNumber: string, actor: Actor): Promise<unknown>;
  deliver(input: ConfirmPickupInput): Promise<unknown>;
  cancel(guideNumber: string, actor: Actor, reason: string): Promise<unknown>;
  findByGuide(guideNumber: string): Promise<unknown>;
  findPublicByGuide(guideNumber: string): Promise<unknown>;
  listByDestination(filter: ListShipmentsFilter): Promise<unknown>;
  listByOrigin(filter: ListShipmentsFilter): Promise<unknown>;
}

export const SHIPMENT_REPOSITORY = Symbol('SHIPMENT_REPOSITORY');
