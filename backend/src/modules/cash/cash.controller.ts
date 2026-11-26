import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/infrastructure/guards/jwt-auth.guard';
import { CashService, todayInBolivia } from './cash.service';

class CloseCashDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  countedCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

@Controller('cash')
@UseGuards(JwtAuthGuard)
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('dashboard')
  dashboard(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ) {
    return this.cash.dashboard(this.cash.resolveBranch(request.user, branchId));
  }

  @Get('summary')
  summary(
    @Req() request: AuthenticatedRequest,
    @Query('date') date?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.cash.summary(
      this.cash.resolveBranch(request.user, branchId),
      date ?? todayInBolivia(),
    );
  }

  @Get('closings')
  closings(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ) {
    return this.cash.history(this.cash.resolveBranch(request.user, branchId));
  }

  @Post('closings')
  close(@Body() dto: CloseCashDto, @Req() request: AuthenticatedRequest) {
    return this.cash.close(
      request.user,
      this.cash.resolveBranch(request.user, dto.branchId),
      dto.date ?? todayInBolivia(),
      dto.countedCash,
      dto.notes,
    );
  }
}
