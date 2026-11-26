import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ConfirmPickupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  receiverCi!: string;

  @IsBoolean()
  @IsOptional()
  payOnDelivery = false;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

export class CancelShipmentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string;
}