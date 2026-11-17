import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { ConfirmPickupDto } from '../../application/dtos/confirm-pickup.dto';
import { RegisterShipmentDto } from '../../application/dtos/register-shipment.dto';
import { ConfirmPickupUseCase } from '../../application/use-cases/confirm-pickup.use-case';
import { DispatchManifestUseCase } from '../../application/use-cases/dispatch-manifest.use-case';
import { RegisterShipmentUseCase } from '../../application/use-cases/register-shipment.use-case';
import { UnpaidShipmentError } from '../../domain/errors/unpaid-shipment.error';

@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly registerShipment: RegisterShipmentUseCase,
    private readonly dispatchManifest: DispatchManifestUseCase,
    private readonly confirmPickup: ConfirmPickupUseCase,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  register(
    @Body() dto: RegisterShipmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    this.assertBranchAccess(request, dto.originBranchId);
    return this.registerShipment.execute({
      originBranchId: dto.originBranchId,
      destinationBranchId: dto.destinationBranchId,
      sender: dto.sender,
      consignee: dto.consignee,
      paymentType: dto.paymentType,
      totalAmount: dto.totalAmount,
      items: dto.items,
      userId: request.user.userId,
    });
  }

  @Get('branch/:branchId')
  @UseGuards(JwtAuthGuard)
  listByBranch(
    @Param('branchId') branchId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown[]> {
    this.assertBranchAccess(request, branchId);
    return this.dispatchManifest.listByBranch(branchId);
  }

  @Patch(':guideNumber/arrive')
  @UseGuards(JwtAuthGuard)
  arrive(
    @Param('guideNumber') guideNumber: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.dispatchManifest.execute(guideNumber, request.user.userId);
  }

  @Patch(':guideNumber/deliver')
  @UseGuards(JwtAuthGuard)
  async deliver(
    @Param('guideNumber') guideNumber: string,
    @Body() dto: ConfirmPickupDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    try {
      return await this.confirmPickup.execute({
        guideNumber,
        userId: request.user.userId,
        receiverCi: dto.receiverCi,
        payOnDelivery: dto.payOnDelivery,
        notes: dto.notes,
      });
    } catch (error) {
      if (error instanceof UnpaidShipmentError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get('track/:guideNumber')
  track(@Param('guideNumber') guideNumber: string): Promise<unknown> {
    return this.dispatchManifest.track(guideNumber);
  }

  private assertBranchAccess(
    request: AuthenticatedRequest,
    branchId: string,
  ): void {
    if (
      request.user.role !== 'ADMIN_CENTRAL' &&
      request.user.branchId !== branchId
    ) {
      throw new ForbiddenException(
        'El usuario no puede operar fuera de su sucursal.',
      );
    }
  }
}