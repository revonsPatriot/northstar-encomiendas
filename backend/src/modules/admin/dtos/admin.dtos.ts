import {
  PaymentType,
  ShipmentStatus,
  UserRole,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @Matches(/^[0-9A-Za-z-]{5,20}$/)
  ci!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Matches(/^[0-9A-Za-z-]{5,20}$/)
  ci?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password?: string;
}

export class CreateBranchDto {
  @Matches(/^[A-Z0-9]{2,8}$/)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(60)
  department!: string;

  @IsString()
  @MaxLength(200)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phones?: string;

  @IsOptional()
  @IsBoolean()
  isOwnOffice?: boolean;
}

export class UpdateBranchDto {
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,8}$/)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phones?: string;

  @IsOptional()
  @IsBoolean()
  isOwnOffice?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRouteDto {
  @IsUUID()
  originBranchId!: string;

  @IsUUID()
  destinationBranchId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  basePrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  pricePerKg?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  estimatedHours?: number;
}

export class UpdateRouteDto {
  @IsOptional()
  @IsUUID()
  originBranchId?: string;

  @IsOptional()
  @IsUUID()
  destinationBranchId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  basePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  pricePerKg?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  estimatedHours?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminCustomerDto {
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

  @IsOptional()
  @IsBoolean()
  isCorporateAccount?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  corporateCreditLimit?: number;
}

export class AdminUpdateShipmentDto {
  @IsOptional()
  @IsUUID()
  originBranchId?: string;

  @IsOptional()
  @IsUUID()
  destinationBranchId?: string;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  receiverCiVerified?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  cancelReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  remarks?: string;
}
