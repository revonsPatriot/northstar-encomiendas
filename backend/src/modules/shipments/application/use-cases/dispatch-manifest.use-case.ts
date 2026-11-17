import { Inject, Injectable } from '@nestjs/common';
import {
  SHIPMENT_REPOSITORY,
} from '../../domain/ports/shipment.repository.port';
import type { ShipmentRepositoryPort } from '../../domain/ports/shipment.repository.port';

@Injectable()
export class DispatchManifestUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY)
    private readonly repository: ShipmentRepositoryPort,
  ) {}

  execute(guideNumber: string, userId: string): Promise<unknown> {
    return this.repository.arrive(guideNumber, userId);
  }

  listByBranch(branchId: string): Promise<unknown[]> {
    return this.repository.findByDestinationBranch(branchId);
  }

  track(guideNumber: string): Promise<unknown> {
    return this.repository.findByGuide(guideNumber);
  }
}