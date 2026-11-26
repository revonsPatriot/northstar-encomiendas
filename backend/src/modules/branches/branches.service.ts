import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../shipments/infrastructure/persistence/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  listActiveBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        department: true,
        address: true,
        phones: true,
        isOwnOffice: true,
      },
    });
  }

  listActiveRoutes() {
    return this.prisma.route.findMany({
      where: {
        isActive: true,
        originBranch: { isActive: true },
        destinationBranch: { isActive: true },
      },
      orderBy: [
        { originBranch: { code: 'asc' } },
        { destinationBranch: { code: 'asc' } },
      ],
      select: {
        id: true,
        originBranchId: true,
        destinationBranchId: true,
        basePrice: true,
        pricePerKg: true,
        estimatedHours: true,
        originBranch: {
          select: { id: true, code: true, name: true, department: true },
        },
        destinationBranch: {
          select: { id: true, code: true, name: true, department: true },
        },
      },
    });
  }

  async getPublicOverview() {
    const [branches, routes, totalShipments, deliveredShipments] =
      await Promise.all([
        this.listActiveBranches(),
        this.listActiveRoutes(),
        this.prisma.shipment.count({
          where: { status: { not: ShipmentStatus.ANULADO } },
        }),
        this.prisma.shipment.count({
          where: { status: ShipmentStatus.ENTREGADO },
        }),
      ]);

    const departments = Array.from(
      new Set(branches.map((branch) => branch.department)),
    );

    return {
      branches,
      routes,
      metrics: {
        activeBranches: branches.length,
        activeRoutes: routes.length,
        departmentsCovered: departments.length,
        totalShipments,
        deliveredShipments,
      },
    };
  }
}
