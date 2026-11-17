import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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
  register(
    @Body() dto: RegisterShipmentDto,
    @Headers('x-user-id') userId?: string,
  ): Promise<unknown> {
    return this.registerShipment.execute({
      originBranchId: dto.originBranchId,
      destinationBranchId: dto.destinationBranchId,
      sender: dto.sender,
      consignee: dto.consignee,
      paymentType: dto.paymentType,
      totalAmount: dto.totalAmount,
      items: dto.items,
      userId: this.requireUserId(userId),
    });
  }

  @Get('branch/:branchId')
  listByBranch(@Param('branchId') branchId: string): Promise<unknown[]> {
    return this.dispatchManifest.listByBranch(branchId);
  }

  @Patch(':guideNumber/arrive')
  arrive(
    @Param('guideNumber') guideNumber: string,
    @Headers('x-user-id') userId?: string,
  ): Promise<unknown> {
    return this.dispatchManifest.execute(guideNumber, this.requireUserId(userId));
  }

  @Patch(':guideNumber/deliver')
  async deliver(
    @Param('guideNumber') guideNumber: string,
    @Body() dto: ConfirmPickupDto,
    @Headers('x-user-id') userId?: string,
  ): Promise<unknown> {
    try {
      return await this.confirmPickup.execute({
        guideNumber,
        userId: this.requireUserId(userId),
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

  private requireUserId(userId?: string): string {
    if (!userId) {
      throw new BadRequestException(
        'El encabezado x-user-id es obligatorio hasta habilitar autenticación JWT.',
      );
    }
    return userId;
  }
}