import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMoment,
  PaymentType as PrismaPaymentType,
  Prisma,
  ShipmentStatus as PrismaShipmentStatus,
} from '@prisma/client';
import {
  InvalidShipmentTransitionError,
  PaymentType,
  ShipmentEntity,
  ShipmentStatus,
} from '../../domain/entities/shipment.entity';
import {
  Actor,
  ConfirmPickupInput,
  CustomerInput,
  ListShipmentsFilter,
  RegisterShipmentInput,
  ShipmentRepositoryPort,
} from '../../domain/ports/shipment.repository.port';
import { PrismaService } from './prisma.service';

type Tx = Prisma.TransactionClient;

const FULL_INCLUDE = {
  items: true,
  sender: true,
  consignee: true,
  originBranch: true,
  destinationBranch: true,
} satisfies Prisma.ShipmentInclude;

const toCents = (value: number): number => Math.round(value * 100);

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterShipmentInput): Promise<unknown> {
    this.assertBranch(input.actor, input.originBranchId);

    if (input.originBranchId === input.destinationBranchId) {
      throw new BadRequestException(
        'La sucursal de origen y destino deben ser distintas.',
      );
    }

    const itemsCents = input.items.reduce(
      (sum, item) => sum + toCents(item.subtotal),
      0,
    );
    if (itemsCents !== toCents(input.totalAmount)) {
      throw new BadRequestException(
        'El monto total no coincide con la suma de los ítems.',
      );
    }
    if (itemsCents <= 0) {
      throw new BadRequestException('El monto total debe ser mayor a cero.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.clientRequestId) {
        const existing = await tx.shipment.findUnique({
          where: { clientRequestId: input.clientRequestId },
          include: FULL_INCLUDE,
        });
        if (existing) return existing;
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('northstar:shipment-guide'))`;

      const [destination, origin] = await Promise.all([
        tx.branch.findFirst({
          where: { id: input.destinationBranchId, isActive: true },
        }),
        tx.branch.findFirst({
          where: { id: input.originBranchId, isActive: true },
        }),
      ]);
      if (!destination || !origin) {
        throw new NotFoundException('La sucursal indicada no existe.');
      }

      const rows = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT COALESCE(MAX(CAST("guideNumber" AS INTEGER)), 4153)::int AS n
        FROM "shipments"
        WHERE "guideNumber" ~ '^[0-9]+$'`;
      const guideNumber = String((rows[0]?.n ?? 4153) + 1).padStart(6, '0');

      const sender = await this.upsertCustomer(tx, input.sender);
      const consignee = await this.upsertCustomer(tx, input.consignee);

      if (input.paymentType === PaymentType.CUENTA_CORPORATIVA) {
        await this.assertCorporateCredit(tx, sender.id, itemsCents);
      }

      const isPaid = input.paymentType === PaymentType.PAGADO_ORIGEN;

      const shipment = await tx.shipment.create({
        data: {
          guideNumber,
          clientRequestId: input.clientRequestId,
          originBranchId: input.originBranchId,
          destinationBranchId: input.destinationBranchId,
          senderId: sender.id,
          consigneeId: consignee.id,
          paymentType: input.paymentType as PrismaPaymentType,
          isPaid,
          totalAmount: itemsCents / 100,
          dispatchedByUserId: input.actor.userId,
          items: {
            create: input.items.map((item) => ({
              quantity: item.quantity,
              description: item.description,
              weightKg: item.weightKg,
              subtotal: item.subtotal,
            })),
          },
          statusLogs: {
            create: {
              newStatus: PrismaShipmentStatus.REGISTRADO,
              changedByUserId: input.actor.userId,
              branchId: input.originBranchId,
              remarks: 'Registro inicial en ventanilla.',
            },
          },
        },
        include: FULL_INCLUDE,
      });

      if (isPaid) {
        await tx.payment.create({
          data: {
            shipmentId: shipment.id,
            branchId: input.originBranchId,
            userId: input.actor.userId,
            amount: itemsCents / 100,
            moment: PaymentMoment.ORIGEN,
          },
        });
      }

      return shipment;
    });
  }

  dispatch(guideNumber: string, actor: Actor): Promise<unknown> {
    return this.transition(guideNumber, actor, 'origin', (entity) => {
      entity.dispatch();
      return {
        data: {},
        remarks: 'Encomienda despachada desde la sucursal de origen.',
      };
    });
  }

  arrive(guideNumber: string, actor: Actor): Promise<unknown> {
    return this.transition(guideNumber, actor, 'destination', (entity) => {
      entity.arrive();
      return {
        data: { arrivedAt: new Date() },
        remarks: 'Arribo confirmado en sucursal destino.',
      };
    });
  }

  cancel(guideNumber: string, actor: Actor, reason: string): Promise<unknown> {
    return this.transition(guideNumber, actor, 'origin', (entity) => {
      entity.cancel();
      return {
        data: { cancelledAt: new Date(), cancelReason: reason },
        remarks: `Guía anulada: ${reason}`,
      };
    });
  }

  async deliver(input: ConfirmPickupInput): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await this.lockShipment(tx, input.guideNumber);
      this.assertBranch(input.actor, shipment.destinationBranchId);

      const consignee = await tx.customer.findUnique({
        where: { id: shipment.consigneeId },
      });
      const expectedCi = consignee?.ciNit?.trim().toLowerCase();
      if (expectedCi && expectedCi !== input.receiverCi.trim().toLowerCase()) {
        throw new BadRequestException(
          'El C.I. de quien recibe no coincide con el del consignatario.',
        );
      }

      const entity = this.toEntity(shipment);
      const previousStatus = entity.currentStatus;
      const newPayment = input.payOnDelivery ? entity.registerPayment() : false;

      try {
        entity.deliver();
      } catch (error) {
        throw this.mapDomainError(error);
      }

      if (newPayment) {
        await tx.payment.create({
          data: {
            shipmentId: shipment.id,
            branchId: input.actor.branchId,
            userId: input.actor.userId,
            amount: shipment.totalAmount,
            moment: PaymentMoment.DESTINO,
          },
        });
      }

      return tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: PrismaShipmentStatus.ENTREGADO,
          isPaid: entity.paid,
          deliveredByUserId: input.actor.userId,
          deliveredAt: new Date(),
          receiverCiVerified: input.receiverCi,
          deliveryNotes: input.notes,
          statusLogs: {
            create: {
              previousStatus: previousStatus as PrismaShipmentStatus,
              newStatus: PrismaShipmentStatus.ENTREGADO,
              changedByUserId: input.actor.userId,
              branchId: input.actor.branchId,
              remarks: newPayment
                ? 'Entrega confirmada con cobro en destino.'
                : 'Entrega confirmada con Recibí Conforme.',
            },
          },
        },
        include: FULL_INCLUDE,
      });
    });
  }

  findByGuide(guideNumber: string): Promise<unknown> {
    return this.prisma.shipment.findUnique({
      where: { guideNumber },
      include: {
        ...FULL_INCLUDE,
        statusLogs: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async findPublicByGuide(guideNumber: string): Promise<unknown> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { guideNumber },
      select: {
        guideNumber: true,
        status: true,
        createdAt: true,
        deliveredAt: true,
        originBranch: { select: { name: true, department: true } },
        destinationBranch: { select: { name: true, department: true } },
        consignee: { select: { fullName: true } },
        statusLogs: {
          orderBy: { createdAt: 'asc' },
          select: {
            newStatus: true,
            createdAt: true,
            branch: { select: { name: true } },
          },
        },
      },
    });
    if (!shipment) return null;

    return {
      guideNumber: shipment.guideNumber,
      status: shipment.status,
      createdAt: shipment.createdAt,
      deliveredAt: shipment.deliveredAt,
      originBranch: shipment.originBranch,
      destinationBranch: shipment.destinationBranch,
      consigneeName: maskName(shipment.consignee.fullName),
      history: shipment.statusLogs.map((log) => ({
        status: log.newStatus,
        at: log.createdAt,
        branch: log.branch.name,
      })),
    };
  }

  listByDestination(filter: ListShipmentsFilter): Promise<unknown> {
    return this.list({ destinationBranchId: filter.branchId }, filter);
  }

  listByOrigin(filter: ListShipmentsFilter): Promise<unknown> {
    return this.list({ originBranchId: filter.branchId }, filter);
  }

  private async list(
    base: Prisma.ShipmentWhereInput,
    filter: ListShipmentsFilter,
  ) {
    const query = filter.query?.trim();
    const where: Prisma.ShipmentWhereInput = {
      ...base,
      ...(filter.statuses?.length
        ? { status: { in: filter.statuses as PrismaShipmentStatus[] } }
        : {}),
      ...(query
        ? {
            OR: [
              { guideNumber: { contains: query } },
              { sender: { fullName: { contains: query, mode: 'insensitive' } } },
              {
                consignee: { fullName: { contains: query, mode: 'insensitive' } },
              },
              { consignee: { ciNit: { contains: query } } },
            ],
          }
        : {}),
    };
    const take = Math.min(filter.take ?? 25, 100);
    const skip = filter.skip ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: FULL_INCLUDE,
      }),
      this.prisma.shipment.count({ where }),
    ]);
    return { items, total, take, skip };
  }

  private async transition(
    guideNumber: string,
    actor: Actor,
    side: 'origin' | 'destination',
    apply: (entity: ShipmentEntity) => {
      data: Prisma.ShipmentUpdateInput;
      remarks: string;
    },
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await this.lockShipment(tx, guideNumber);
      this.assertBranch(
        actor,
        side === 'origin'
          ? shipment.originBranchId
          : shipment.destinationBranchId,
      );

      const entity = this.toEntity(shipment);
      const previousStatus = entity.currentStatus;
      let result: ReturnType<typeof apply>;
      try {
        result = apply(entity);
      } catch (error) {
        throw this.mapDomainError(error);
      }

      return tx.shipment.update({
        where: { id: shipment.id },
        data: {
          ...result.data,
          status: entity.currentStatus as PrismaShipmentStatus,
          statusLogs: {
            create: {
              previousStatus: previousStatus as PrismaShipmentStatus,
              newStatus: entity.currentStatus as PrismaShipmentStatus,
              changedByUserId: actor.userId,
              branchId: actor.branchId,
              remarks: result.remarks,
            },
          },
        },
        include: FULL_INCLUDE,
      });
    });
  }

  /** Bloquea la fila para evitar transiciones concurrentes sobre la misma guía. */
  private async lockShipment(tx: Tx, guideNumber: string) {
    await tx.$executeRaw`SELECT 1 FROM "shipments" WHERE "guideNumber" = ${guideNumber} FOR UPDATE`;
    const shipment = await tx.shipment.findUnique({ where: { guideNumber } });
    if (!shipment) {
      throw new NotFoundException(`No existe la guía ${guideNumber}.`);
    }
    return shipment;
  }

  private toEntity(shipment: {
    id: string;
    guideNumber: string;
    status: PrismaShipmentStatus;
    paymentType: PrismaPaymentType;
    isPaid: boolean;
  }): ShipmentEntity {
    return new ShipmentEntity({
      id: shipment.id,
      guideNumber: shipment.guideNumber,
      status: shipment.status as ShipmentStatus,
      paymentType: shipment.paymentType as PaymentType,
      isPaid: shipment.isPaid,
    });
  }

  private mapDomainError(error: unknown): unknown {
    if (error instanceof InvalidShipmentTransitionError) {
      return new ConflictException(error.message);
    }
    return error;
  }

  private assertBranch(actor: Actor, branchId: string): void {
    if (actor.role !== 'ADMIN_CENTRAL' && actor.branchId !== branchId) {
      throw new ForbiddenException(
        'El usuario no puede operar fuera de su sucursal.',
      );
    }
  }

  private async assertCorporateCredit(
    tx: Tx,
    senderId: string,
    newAmountCents: number,
  ): Promise<void> {
    const sender = await tx.customer.findUnique({ where: { id: senderId } });
    if (!sender?.isCorporateAccount) {
      throw new BadRequestException(
        'El remitente no tiene una cuenta corporativa habilitada.',
      );
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const used = await tx.shipment.aggregate({
      _sum: { totalAmount: true },
      where: {
        senderId,
        paymentType: PrismaPaymentType.CUENTA_CORPORATIVA,
        status: { not: PrismaShipmentStatus.ANULADO },
        createdAt: { gte: monthStart },
      },
    });
    const usedCents = toCents(Number(used._sum.totalAmount ?? 0));
    const limitCents = toCents(Number(sender.corporateCreditLimit));
    if (usedCents + newAmountCents > limitCents) {
      throw new BadRequestException(
        'El envío excede el límite de crédito de la cuenta corporativa.',
      );
    }
  }

  private async upsertCustomer(tx: Tx, input: CustomerInput) {
    const ciNit = input.ciNit?.trim() || undefined;
    const phone = input.phone?.trim() || undefined;
    const fullName = input.fullName.trim();

    if (ciNit) {
      return tx.customer.upsert({
        where: { ciNit },
        update: { ...(phone ? { phone } : {}) },
        create: { ciNit, fullName, phone },
      });
    }

    if (phone) {
      const existing = await tx.customer.findFirst({
        where: { ciNit: null, phone, fullName: { equals: fullName, mode: 'insensitive' } },
      });
      if (existing) return existing;
    }

    return tx.customer.create({ data: { fullName, phone } });
  }
}

function maskName(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part : `${part.charAt(0).toUpperCase()}.`,
    )
    .join(' ');
}
