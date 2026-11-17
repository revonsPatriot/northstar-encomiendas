import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentType as PrismaPaymentType,
  ShipmentStatus as PrismaShipmentStatus,
} from '@prisma/client';
import {
  PaymentType,
  ShipmentEntity,
  ShipmentStatus,
} from '../../domain/entities/shipment.entity';
import {
  ConfirmPickupInput,
  CustomerInput,
  RegisterShipmentInput,
  ShipmentRepositoryPort,
} from '../../domain/ports/shipment.repository.port';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterShipmentInput): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('northstar:shipment-guide'))`;

      const latest = await tx.shipment.findFirst({
        orderBy: { guideNumber: 'desc' },
        select: { guideNumber: true },
      });
      const currentNumber = latest ? Number.parseInt(latest.guideNumber, 10) : 4153;
      if (!Number.isSafeInteger(currentNumber)) {
        throw new Error('El último correlativo de guía no es válido.');
      }

      const guideNumber = String(currentNumber + 1).padStart(6, '0');
      const sender = await this.upsertCustomer(tx, input.sender);
      const consignee = await this.upsertCustomer(tx, input.consignee);
      const isPaid = input.paymentType !== PaymentType.POR_PAGAR;

      return tx.shipment.create({
        data: {
          guideNumber,
          originBranchId: input.originBranchId,
          destinationBranchId: input.destinationBranchId,
          senderId: sender.id,
          consigneeId: consignee.id,
          paymentType: input.paymentType as PrismaPaymentType,
          isPaid,
          totalAmount: input.totalAmount,
          dispatchedByUserId: input.userId,
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
              changedByUserId: input.userId,
              branchId: input.originBranchId,
              remarks: 'Registro inicial en ventanilla.',
            },
          },
        },
        include: { items: true, sender: true, consignee: true },
      });
    });
  }

  async arrive(guideNumber: string, userId: string): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { guideNumber },
      });
      if (!shipment) {
        throw new NotFoundException(`No existe la guía ${guideNumber}.`);
      }

      const entity = new ShipmentEntity({
        id: shipment.id,
        guideNumber: shipment.guideNumber,
        status: shipment.status as ShipmentStatus,
        paymentType: shipment.paymentType as PaymentType,
        isPaid: shipment.isPaid,
      });
      const previousStatus = entity.currentStatus;
      entity.arrive();
      const user = await this.getUser(tx, userId);

      return tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: entity.currentStatus as PrismaShipmentStatus,
          arrivedAt: new Date(),
          statusLogs: {
            create: {
              previousStatus: previousStatus as PrismaShipmentStatus,
              newStatus: PrismaShipmentStatus.EN_SUCURSAL_DESTINO,
              changedByUserId: user.id,
              branchId: user.branchId,
              remarks: 'Arribo confirmado en sucursal destino.',
            },
          },
        },
        include: { items: true, sender: true, consignee: true },
      });
    });
  }

  async deliver(input: ConfirmPickupInput): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { guideNumber: input.guideNumber },
      });
      if (!shipment) {
        throw new NotFoundException(`No existe la guía ${input.guideNumber}.`);
      }

      const entity = new ShipmentEntity({
        id: shipment.id,
        guideNumber: shipment.guideNumber,
        status: shipment.status as ShipmentStatus,
        paymentType: shipment.paymentType as PaymentType,
        isPaid: shipment.isPaid,
      });
      const previousStatus = entity.currentStatus;
      if (input.payOnDelivery) {
        entity.registerPayment();
      }
      entity.deliver();
      const user = await this.getUser(tx, input.userId);

      return tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: PrismaShipmentStatus.ENTREGADO,
          isPaid: entity.paid,
          deliveredByUserId: user.id,
          deliveredAt: new Date(),
          receiverCiVerified: input.receiverCi,
          deliveryNotes: input.notes,
          statusLogs: {
            create: {
              previousStatus: previousStatus as PrismaShipmentStatus,
              newStatus: PrismaShipmentStatus.ENTREGADO,
              changedByUserId: user.id,
              branchId: user.branchId,
              remarks: input.payOnDelivery
                ? 'Entrega confirmada con cobro en destino.'
                : 'Entrega confirmada con Recibí Conforme.',
            },
          },
        },
        include: { items: true, sender: true, consignee: true },
      });
    });
  }

  findByGuide(guideNumber: string): Promise<unknown> {
    return this.prisma.shipment.findUnique({
      where: { guideNumber },
      include: { items: true, sender: true, consignee: true, statusLogs: true },
    });
  }

  findByDestinationBranch(branchId: string): Promise<unknown[]> {
    return this.prisma.shipment.findMany({
      where: {
        destinationBranchId: branchId,
        status: PrismaShipmentStatus.EN_SUCURSAL_DESTINO,
      },
      orderBy: { arrivedAt: 'asc' },
      include: { items: true, sender: true, consignee: true },
    });
  }

  private async upsertCustomer(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    input: CustomerInput,
  ) {
    if (input.ciNit) {
      return tx.customer.upsert({
        where: { ciNit: input.ciNit },
        update: { fullName: input.fullName, phone: input.phone },
        create: {
          ciNit: input.ciNit,
          fullName: input.fullName,
          phone: input.phone,
        },
      });
    }

    return tx.customer.create({
      data: { fullName: input.fullName, phone: input.phone },
    });
  }

  private async getUser(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, branchId: true },
    });
    if (!user) {
      throw new NotFoundException(`No existe el usuario operador ${userId}.`);
    }
    return user;
  }
}