export interface ShipmentItemProps {
  quantity: number;
  description: string;
  weightKg?: number;
  subtotal: number;
}

export class ShipmentItemEntity {
  readonly quantity: number;
  readonly description: string;
  readonly weightKg?: number;
  readonly subtotal: number;

  constructor(props: ShipmentItemProps) {
    this.quantity = props.quantity;
    this.description = props.description;
    this.weightKg = props.weightKg;
    this.subtotal = props.subtotal;
  }
}