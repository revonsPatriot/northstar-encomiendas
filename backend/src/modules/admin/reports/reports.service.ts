import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMoment, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../shipments/infrastructure/persistence/prisma.service';
import {
  addDays,
  boliviaMidnight,
  isValidYmd,
  listDays,
  previousRange,
  resolveRange,
  type ReportPeriod,
} from './report-range.util';

const BOLIVIA_OFFSET_MS = 4 * 60 * 60 * 1000;
const MAX_ROWS = 5000;

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const round2 = (value: number): number => Math.round(value * 100) / 100;

const formatDmy = (ymd: string): string =>
  `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;

function buildLabel(period: ReportPeriod, startYmd: string, endYmd: string) {
  if (period === 'day') return `Reporte diario · ${formatDmy(startYmd)}`;
  if (period === 'week') {
    return `Reporte semanal · ${formatDmy(startYmd)} al ${formatDmy(addDays(endYmd, -1))}`;
  }
  const month = Number(startYmd.slice(5, 7)) - 1;
  return `Reporte mensual · ${MONTHS[month]} ${startYmd.slice(0, 4)}`;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(period: ReportPeriod, anchorYmd: string, branchId?: string) {
    if (!isValidYmd(anchorYmd)) {
      throw new BadRequestException('Fecha inválida. Usa el formato AAAA-MM-DD.');
    }

    const range = resolveRange(period, anchorYmd);
    const previous = previousRange(period, range);
    const from = boliviaMidnight(range.startYmd);
    const to = boliviaMidnight(range.endYmd);
    const originFilter = branchId ? { originBranchId: branchId } : {};

    const [shipments, previousAggregate, payments] = await Promise.all([
      this.prisma.shipment.findMany({
        where: { createdAt: { gte: from, lt: to }, ...originFilter },
        orderBy: { createdAt: 'asc' },
        take: MAX_ROWS,
        select: {
          guideNumber: true,
          createdAt: true,
          status: true,
          paymentType: true,
          isPaid: true,
          totalAmount: true,
          originBranch: { select: { code: true, name: true } },
          destinationBranch: { select: { code: true, name: true } },
          sender: { select: { fullName: true } },
          consignee: { select: { fullName: true } },
          items: { select: { quantity: true, weightKg: true } },
        },
      }),
      this.prisma.shipment.aggregate({
        _count: true,
        _sum: { totalAmount: true },
        where: {
          createdAt: {
            gte: boliviaMidnight(previous.startYmd),
            lt: boliviaMidnight(previous.endYmd),
          },
          status: { not: ShipmentStatus.ANULADO },
          ...originFilter,
        },
      }),
      this.prisma.payment.groupBy({
        by: ['moment'],
        _sum: { amount: true },
        where: {
          createdAt: { gte: from, lt: to },
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    const byStatus: Record<ShipmentStatus, number> = {
      REGISTRADO: 0,
      EN_TRANSITO: 0,
      EN_SUCURSAL_DESTINO: 0,
      ENTREGADO: 0,
      ANULADO: 0,
    };

    const isHourly = period === 'day';
    const seriesMap = new Map<
      string,
      { key: string; label: string; count: number; amount: number }
    >();
    if (isHourly) {
      for (let hour = 0; hour < 24; hour += 1) {
        const key = String(hour).padStart(2, '0');
        seriesMap.set(key, { key, label: `${key}h`, count: 0, amount: 0 });
      }
    } else {
      for (const day of listDays(range)) {
        seriesMap.set(day, {
          key: day,
          label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
          count: 0,
          amount: 0,
        });
      }
    }

    const paymentMap = new Map<string, { count: number; amount: number }>();
    const originMap = new Map<
      string,
      { code: string; name: string; count: number; amount: number }
    >();
    const routeMap = new Map<string, { count: number; amount: number }>();

    let billed = 0;
    let paidAmount = 0;
    let weightKg = 0;
    let active = 0;

    const rows = shipments.map((shipment) => {
      const amount = Number(shipment.totalAmount);
      const weight = shipment.items.reduce(
        (sum, item) => sum + Number(item.weightKg ?? 0),
        0,
      );
      byStatus[shipment.status] += 1;

      if (shipment.status !== ShipmentStatus.ANULADO) {
        active += 1;
        billed += amount;
        weightKg += weight;
        if (shipment.isPaid) paidAmount += amount;

        const local = new Date(shipment.createdAt.getTime() - BOLIVIA_OFFSET_MS);
        const bucketKey = isHourly
          ? String(local.getUTCHours()).padStart(2, '0')
          : local.toISOString().slice(0, 10);
        const bucket = seriesMap.get(bucketKey);
        if (bucket) {
          bucket.count += 1;
          bucket.amount += amount;
        }

        const payment = paymentMap.get(shipment.paymentType) ?? {
          count: 0,
          amount: 0,
        };
        payment.count += 1;
        payment.amount += amount;
        paymentMap.set(shipment.paymentType, payment);

        const origin = originMap.get(shipment.originBranch.code) ?? {
          code: shipment.originBranch.code,
          name: shipment.originBranch.name,
          count: 0,
          amount: 0,
        };
        origin.count += 1;
        origin.amount += amount;
        originMap.set(shipment.originBranch.code, origin);

        const routeKey = `${shipment.originBranch.code} → ${shipment.destinationBranch.code}`;
        const route = routeMap.get(routeKey) ?? { count: 0, amount: 0 };
        route.count += 1;
        route.amount += amount;
        routeMap.set(routeKey, route);
      }

      return {
        guideNumber: shipment.guideNumber,
        createdAt: shipment.createdAt.toISOString(),
        origin: shipment.originBranch.code,
        destination: shipment.destinationBranch.code,
        sender: shipment.sender.fullName,
        consignee: shipment.consignee.fullName,
        status: shipment.status,
        paymentType: shipment.paymentType,
        isPaid: shipment.isPaid,
        totalAmount: round2(amount),
        weightKg: round2(weight),
      };
    });

    const collected = (moment: PaymentMoment) =>
      round2(
        Number(payments.find((p) => p.moment === moment)?._sum.amount ?? 0),
      );

    return {
      period,
      from: range.startYmd,
      to: addDays(range.endYmd, -1),
      label: buildLabel(period, range.startYmd, range.endYmd),
      generatedAt: new Date().toISOString(),
      branchId: branchId ?? null,
      truncated: shipments.length >= MAX_ROWS,
      totals: {
        shipments: active,
        cancelled: byStatus.ANULADO,
        delivered: byStatus.ENTREGADO,
        inTransit: byStatus.EN_TRANSITO,
        billed: round2(billed),
        paidAmount: round2(paidAmount),
        pendingAmount: round2(billed - paidAmount),
        weightKg: round2(weightKg),
        averageTicket: active > 0 ? round2(billed / active) : 0,
      },
      previous: {
        shipments: previousAggregate._count,
        billed: round2(Number(previousAggregate._sum.totalAmount ?? 0)),
      },
      byStatus,
      byPayment: Array.from(paymentMap, ([paymentType, value]) => ({
        paymentType,
        count: value.count,
        amount: round2(value.amount),
      })),
      series: Array.from(seriesMap.values()).map((bucket) => ({
        ...bucket,
        amount: round2(bucket.amount),
      })),
      byOrigin: Array.from(originMap.values())
        .map((origin) => ({ ...origin, amount: round2(origin.amount) }))
        .sort((a, b) => b.count - a.count),
      topRoutes: Array.from(routeMap, ([route, value]) => ({
        route,
        count: value.count,
        amount: round2(value.amount),
      }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      collected: {
        origin: collected(PaymentMoment.ORIGEN),
        destination: collected(PaymentMoment.DESTINO),
      },
      rows,
    };
  }
}
