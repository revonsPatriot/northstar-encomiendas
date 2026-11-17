import { PaymentType } from '../entities/shipment.entity';

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

export interface RegisterShipmentInput {
  originBranchId: string;
  destinationBranchId: string;
  sender: CustomerInput;
  consignee: CustomerInput;
  paymentType: PaymentType;
  totalAmount: number;
  items: ShipmentItemInput[];
  userId: string;
}

export interface ConfirmPickupInput {
  guideNumber: string;
  userId: string;
  receiverCi: string;
  notes?: string;
  payOnDelivery: boolean;
}

export interface ShipmentRepositoryPort {
  register(input: RegisterShipmentInput): Promise<unknown>;
  arrive(guideNumber: string, userId: string): Promise<unknown>;
  deliver(input: ConfirmPickupInput): Promise<unknown>;
  findByGuide(guideNumber: string): Promise<unknown>;
  findByDestinationBranch(branchId: string): Promise<unknown[]>;
}

export const SHIPMENT_REPOSITORY = Symbol('SHIPMENT_REPOSITORY');