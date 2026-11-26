import { Module } from '@nestjs/common';
import { ConfirmPickupUseCase } from './application/use-cases/confirm-pickup.use-case';
import { DispatchManifestUseCase } from './application/use-cases/dispatch-manifest.use-case';
import { RegisterShipmentUseCase } from './application/use-cases/register-shipment.use-case';
import { SHIPMENT_REPOSITORY } from './domain/ports/shipment.repository.port';
import {
  PublicTrackingController,
  ShipmentsController,
} from './infrastructure/controllers/shipments.controller';
import { PrismaShipmentRepository } from './infrastructure/persistence/prisma-shipment.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';

@Module({
  controllers: [ShipmentsController, PublicTrackingController],
  providers: [
    PrismaService,
    PrismaShipmentRepository,
    RegisterShipmentUseCase,
    DispatchManifestUseCase,
    ConfirmPickupUseCase,
    {
      provide: SHIPMENT_REPOSITORY,
      useExisting: PrismaShipmentRepository,
    },
  ],
  exports: [PrismaService],
})
export class ShipmentsModule {}
