import { PaymentType } from '../../domain/entities/shipment.entity';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomerDto {
  @IsOptional()
  @IsString()
  ciNit?: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class ShipmentItemDto {
  @IsPositive()
  quantity!: number;

  @IsString()
  description!: string;

  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @IsNumber()
  subtotal!: number;
}

export class RegisterShipmentDto {
  @IsString()
  originBranchId!: string;

  @IsString()
  destinationBranchId!: string;

  @ValidateNested()
  @Type(() => CustomerDto)
  sender!: CustomerDto;

  @ValidateNested()
  @Type(() => CustomerDto)
  consignee!: CustomerDto;

  @IsEnum(PaymentType)
  paymentType!: PaymentType;

  @IsNumber()
  totalAmount!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items!: ShipmentItemDto[];
}