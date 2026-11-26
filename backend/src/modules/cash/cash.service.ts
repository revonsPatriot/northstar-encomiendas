import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PaymentMoment, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../shipments/infrastructure/persistence/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.service';

import { TZ_OFFSET, todayInBolivia } from './date.util';

export { todayInBolivia };

function dayBounds(date: string): { from: Date; to: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('Fecha inválida. Usa el formato AAAA-MM-DD.');
  }
  const from = new Date(`${date}T00:00:00.000${TZ_OFFSET}`);
  if (Number.isNaN(from.getTime())) {
    throw new BadRequestException('Fecha inválida.');
  }
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  resolveBranch(user: AuthenticatedUser, requested?: string): string {
    if (!requested || requested === user.branchId) return user.branchId;
    if (user.role !== 'ADMIN_CENTRAL') {
      throw new ForbiddenException(
        'El usuario no puede operar fuera de su sucursal.',
      );
    }
    return requested;
  }

  async summary(branchId: string, date: string) {
    const { from, to } = dayBounds(date);
    const grouped = await this.prisma.payment.groupBy({
      by: ['moment'],
      where: { branchId, createdAt: { gte: from, lt: to } },
      _sum: { amount: true },
      _count: true,
    });

    const pick = (moment: PaymentMoment) => {
      const row = grouped.find((item) => item.moment === moment);
      return {
        amount: Number(row?._sum.amount ?? 0),
        count: row?._count ?? 0,
      };
    };
    const origin = pick(PaymentMoment.ORIGEN);
    const destination = pick(PaymentMoment.DESTINO);

    const closing = await this.prisma.cashClosing.findUnique({
      where: {
        branchId_closingDate: {
          branchId,
          closingDate: new Date(`${date}T00:00:00.000Z`),
        },
      },
    });

    return {
      date,
      branchId,
      origin,
      destination,
      expectedTotal: Math.round((origin.amount + destination.amount) * 100) / 100,
      closing,
    };
  }

  async close(
    user: AuthenticatedUser,
    branchId: string,
    date: string,
    countedCash: number,
    notes?: string,
  ) {
    const summary = await this.summary(branchId, date);
    if (summary.closing) {
      throw new ConflictException('El arqueo de esa fecha ya fue registrado.');
    }

    const expectedCents = Math.round(summary.expectedTotal * 100);
    const countedCents = Math.round(countedCash * 100);
    const difference = (countedCents - expectedCents) / 100;
    if (difference !== 0 && !notes?.trim()) {
      throw new BadRequestException(
        'Hay una diferencia en caja: agrega una observación que la explique.',
      );
    }

    return this.prisma.cashClosing.create({
      data: {
        branchId,
        userId: user.userId,
        closingDate: new Date(`${date}T00:00:00.000Z`),
        expectedOrigin: summary.origin.amount,
        expectedDestination: summary.destination.amount,
        countedCash: countedCents / 100,
        difference,
        notes: notes?.trim() || null,
      },
    });
  }

  history(branchId: string, take = 30) {
    return this.prisma.cashClosing.findMany({
      where: { branchId },
      orderBy: { closingDate: 'desc' },
      take: Math.min(take, 100),
      include: { user: { select: { fullName: true } } },
    });
  }

  async dashboard(branchId: string) {
    const { from, to } = dayBounds(todayInBolivia());
    const [registeredToday, readyForDelivery, incoming, outgoingPending, cash] =
      await Promise.all([
        this.prisma.shipment.count({
          where: {
            originBranchId: branchId,
            createdAt: { gte: from, lt: to },
            status: { not: ShipmentStatus.ANULADO },
          },
        }),
        this.prisma.shipment.count({
          where: {
            destinationBranchId: branchId,
            status: ShipmentStatus.EN_SUCURSAL_DESTINO,
          },
        }),
        this.prisma.shipment.count({
          where: {
            destinationBranchId: branchId,
            status: {
              in: [ShipmentStatus.REGISTRADO, ShipmentStatus.EN_TRANSITO],
            },
          },
        }),
        this.prisma.shipment.count({
          where: {
            originBranchId: branchId,
            status: ShipmentStatus.REGISTRADO,
          },
        }),
        this.prisma.payment.aggregate({
          where: { branchId, createdAt: { gte: from, lt: to } },
          _sum: { amount: true },
        }),
      ]);

    return {
      registeredToday,
      readyForDelivery,
      incoming,
      outgoingPending,
      cashToday: Number(cash._sum.amount ?? 0),
    };
  }
}
