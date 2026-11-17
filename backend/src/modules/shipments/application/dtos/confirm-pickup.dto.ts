import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ConfirmPickupDto {
  @IsString()
  receiverCi!: string;

  @IsBoolean()
  @IsOptional()
  payOnDelivery = false;

  @IsString()
  @IsOptional()
  notes?: string;
}