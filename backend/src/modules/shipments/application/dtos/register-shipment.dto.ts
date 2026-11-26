import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentType } from '../../domain/entities/shipment.entity';

class CustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ciNit?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

class ShipmentItemDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  weightKg?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  subtotal!: number;
}

export class RegisterShipmentDto {
  @IsUUID()
  originBranchId!: string;

  @IsUUID()
  destinationBranchId!: string;

  @ValidateNested()
  @Type(() => CustomerDto)
  sender!: CustomerDto;

  @ValidateNested()
  @Type(() => CustomerDto)
  consignee!: CustomerDto;

  @IsEnum(PaymentType)
  paymentType!: PaymentType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalAmount!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items!: ShipmentItemDto[];

  /** Clave de idempotencia generada por el cliente (cola offline). */
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
}