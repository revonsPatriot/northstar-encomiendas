import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  DefaultValuePipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TrackRateLimitGuard } from '../../../../common/guards/rate-limit.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import type { AuthenticatedRequest } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import {
  CancelShipmentDto,
  ConfirmPickupDto,
} from '../../application/dtos/confirm-pickup.dto';
import { RegisterShipmentDto } from '../../application/dtos/register-shipment.dto';
import { ConfirmPickupUseCase } from '../../application/use-cases/confirm-pickup.use-case';
import { DispatchManifestUseCase } from '../../application/use-cases/dispatch-manifest.use-case';
import { RegisterShipmentUseCase } from '../../application/use-cases/register-shipment.use-case';
import { ShipmentStatus } from '../../domain/entities/shipment.entity';
import { UnpaidShipmentError } from '../../domain/errors/unpaid-shipment.error';
import type { Actor } from '../../domain/ports/shipment.repository.port';

const GUIDE_PATTERN = /^[0-9]{1,12}$/;

function parseStatuses(raw: string | undefined): ShipmentStatus[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(',').map((value) => value.trim());
  const valid = Object.values(ShipmentStatus) as string[];
  if (values.some((value) => !valid.includes(value))) {
    throw new BadRequestException('Estado de envío inválido.');
  }
  return values as ShipmentStatus[];
}

function assertGuide(guideNumber: string): string {
  if (!GUIDE_PATTERN.test(guideNumber)) {
    throw new BadRequestException('Número de guía inválido.');
  }
  return guideNumber;
}

@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShipmentsController {
  constructor(
    private readonly registerShipment: RegisterShipmentUseCase,
    private readonly dispatchManifest: DispatchManifestUseCase,
    private readonly confirmPickup: ConfirmPickupUseCase,
  ) {}

  @Post()
  register(
    @Body() dto: RegisterShipmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.registerShipment.execute({
      originBranchId: dto.originBranchId,
      destinationBranchId: dto.destinationBranchId,
      sender: dto.sender,
      consignee: dto.consignee,
      paymentType: dto.paymentType,
      totalAmount: dto.totalAmount,
      items: dto.items,
      clientRequestId: dto.clientRequestId,
      actor: this.actor(request),
    });
  }

  /** Encomiendas en sucursal destino listas para entrega. */
  @Get('branch/:branchId')
  listByBranch(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query('q') query: string | undefined,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    this.assertBranchAccess(request, branchId);
    return this.dispatchManifest.listByDestination({
      branchId,
      statuses: [ShipmentStatus.EN_SUCURSAL_DESTINO],
      query,
      take,
      skip,
    });
  }

  /** Encomiendas que vienen en camino hacia la sucursal. */
  @Get('incoming/:branchId')
  listIncoming(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query('q') query: string | undefined,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    this.assertBranchAccess(request, branchId);
    return this.dispatchManifest.listByDestination({
      branchId,
      statuses: [ShipmentStatus.REGISTRADO, ShipmentStatus.EN_TRANSITO],
      query,
      take,
      skip,
    });
  }

  /** Historial de envíos emitidos por la sucursal. */
  @Get('outgoing/:branchId')
  listOutgoing(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query('status') status: string | undefined,
    @Query('q') query: string | undefined,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    this.assertBranchAccess(request, branchId);
    return this.dispatchManifest.listByOrigin({
      branchId,
      statuses: parseStatuses(status),
      query,
      take,
      skip,
    });
  }

  @Patch(':guideNumber/dispatch')
  dispatch(
    @Param('guideNumber') guideNumber: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.dispatchManifest.dispatch(
      assertGuide(guideNumber),
      this.actor(request),
    );
  }

  @Patch(':guideNumber/arrive')
  arrive(
    @Param('guideNumber') guideNumber: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.dispatchManifest.execute(
      assertGuide(guideNumber),
      this.actor(request),
    );
  }

  @Patch(':guideNumber/cancel')
  @Roles('ADMIN_CENTRAL', 'ENCARGADO_SUCURSAL')
  cancel(
    @Param('guideNumber') guideNumber: string,
    @Body() dto: CancelShipmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.dispatchManifest.cancel(
      assertGuide(guideNumber),
      this.actor(request),
      dto.reason,
    );
  }

  @Patch(':guideNumber/deliver')
  async deliver(
    @Param('guideNumber') guideNumber: string,
    @Body() dto: ConfirmPickupDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    try {
      return await this.confirmPickup.execute({
        guideNumber: assertGuide(guideNumber),
        actor: this.actor(request),
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

  @Get(':guideNumber')
  async detail(
    @Param('guideNumber') guideNumber: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    const shipment = (await this.dispatchManifest.detail(
      assertGuide(guideNumber),
    )) as { originBranchId: string; destinationBranchId: string };
    const user = request.user;
    if (
      user.role !== 'ADMIN_CENTRAL' &&
      user.branchId !== shipment.originBranchId &&
      user.branchId !== shipment.destinationBranchId
    ) {
      throw new ForbiddenException('No tienes acceso a esta guía.');
    }
    return shipment;
  }

  private actor(request: AuthenticatedRequest): Actor {
    return {
      userId: request.user.userId,
      branchId: request.user.branchId,
      role: request.user.role,
    };
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

/** Rastreo público (sin sesión) con datos reducidos. */
@Controller('public/track')
export class PublicTrackingController {
  constructor(private readonly dispatchManifest: DispatchManifestUseCase) {}

  @Get(':guideNumber')
  @UseGuards(TrackRateLimitGuard)
  track(@Param('guideNumber') guideNumber: string): Promise<unknown> {
    return this.dispatchManifest.track(assertGuide(guideNumber.trim()));
  }
}
