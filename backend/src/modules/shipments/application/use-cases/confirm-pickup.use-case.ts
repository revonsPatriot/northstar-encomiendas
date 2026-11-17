import { Inject, Injectable } from '@nestjs/common';
import {
  SHIPMENT_REPOSITORY,
} from '../../domain/ports/shipment.repository.port';
import type {
  ConfirmPickupInput,
  ShipmentRepositoryPort,
} from '../../domain/ports/shipment.repository.port';

@Injectable()
export class ConfirmPickupUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY)
    private readonly repository: ShipmentRepositoryPort,
  ) {}

  execute(input: ConfirmPickupInput): Promise<unknown> {
    return this.repository.deliver(input);
  }
}