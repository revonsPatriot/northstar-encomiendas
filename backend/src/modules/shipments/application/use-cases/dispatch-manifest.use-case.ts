import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SHIPMENT_REPOSITORY } from '../../domain/ports/shipment.repository.port';
import type {
  Actor,
  ListShipmentsFilter,
  ShipmentRepositoryPort,
} from '../../domain/ports/shipment.repository.port';

@Injectable()
export class DispatchManifestUseCase {
  constructor(
    @Inject(SHIPMENT_REPOSITORY)
    private readonly repository: ShipmentRepositoryPort,
  ) {}

  dispatch(guideNumber: string, actor: Actor): Promise<unknown> {
    return this.repository.dispatch(guideNumber, actor);
  }

  execute(guideNumber: string, actor: Actor): Promise<unknown> {
    return this.repository.arrive(guideNumber, actor);
  }

  cancel(guideNumber: string, actor: Actor, reason: string): Promise<unknown> {
    return this.repository.cancel(guideNumber, actor, reason);
  }

  listByDestination(filter: ListShipmentsFilter): Promise<unknown> {
    return this.repository.listByDestination(filter);
  }

  listByOrigin(filter: ListShipmentsFilter): Promise<unknown> {
    return this.repository.listByOrigin(filter);
  }

  async track(guideNumber: string): Promise<unknown> {
    const result = await this.repository.findPublicByGuide(guideNumber);
    if (!result) {
      throw new NotFoundException(`No existe la guía ${guideNumber}.`);
    }
    return result;
  }

  async detail(guideNumber: string): Promise<unknown> {
    const result = await this.repository.findByGuide(guideNumber);
    if (!result) {
      throw new NotFoundException(`No existe la guía ${guideNumber}.`);
    }
    return result;
  }
}