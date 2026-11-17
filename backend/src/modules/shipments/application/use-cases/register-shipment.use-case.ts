import { Inject, Injectable } from '@nestjs/common';
import {
  SHIPMENT_REPOSITORY,
} from '../../domain/ports/shipment.repository.port';
import type {
  RegisterShipmentInput,
  ShipmentRepositoryPort,
} from '../../domain/ports/shipment.repository.port';

@Injectable()
export class RegisterShipmentUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY)
    private readonly repository: ShipmentRepositoryPort,
  ) {}

  execute(input: RegisterShipmentInput): Promise<unknown> {
    return this.repository.register(input);
  }
}