import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMoment,
  PaymentType,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../shipments/infrastructure/persistence/prisma.service';
import {
  AdminCustomerDto,
  AdminUpdateShipmentDto,
  CreateBranchDto,
  CreateRouteDto,
  CreateUserDto,
  UpdateBranchDto,
  UpdateRouteDto,
  UpdateUserDto,
} from './dtos/admin.dtos';

const userSelect = {
  id: true,
  fullName: true,
  ci: true,
  role: true,
  isActive: true,
  branchId: true,
  createdAt: true,
  branch: { select: { name: true, code: true } },
} as const;

const routeInclude = {
  originBranch: {
    select: { id: true, code: true, name: true, department: true },
  },
  destinationBranch: {
    select: { id: true, code: true, name: true, department: true },
  },
} as const;

const shipmentInclude = {
  items: true,
  sender: true,
  consignee: true,
  originBranch: { select: { id: true, code: true, name: true, department: true } },
  destinationBranch: { select: { id: true, code: true, name: true, department: true } },
  statusLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 8,
    include: {
      branch: { select: { code: true, name: true } },
      changedByUser: { select: { fullName: true } },
    },
  },
} satisfies Prisma.ShipmentInclude;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // --- RESUMEN GLOBAL ---

  async getOverview() {
    const [
      byStatus,
      paymentsByMoment,
      branchesCount,
      routesCount,
      usersCount,
      customersCount,
    ] = await Promise.all([
      this.prisma.shipment.groupBy({
        by: ['status'],
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['moment'],
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.branch.count({ where: { isActive: true } }),
      this.prisma.route.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.customer.count(),
    ]);

    const statusCounts: Record<ShipmentStatus, number> = {
      REGISTRADO: 0,
      EN_TRANSITO: 0,
      EN_SUCURSAL_DESTINO: 0,
      ENTREGADO: 0,
      ANULADO: 0,
    };
    let totalShipments = 0;
    let totalBilled = 0;

    for (const row of byStatus) {
      statusCounts[row.status] = row._count;
      totalShipments += row._count;
      if (row.status !== ShipmentStatus.ANULADO) {
        totalBilled += Number(row._sum.totalAmount ?? 0);
      }
    }

    const originPayments =
      Number(
        paymentsByMoment.find((p) => p.moment === PaymentMoment.ORIGEN)?._sum
          .amount ?? 0,
      );
    const destinationPayments =
      Number(
        paymentsByMoment.find((p) => p.moment === PaymentMoment.DESTINO)?._sum
          .amount ?? 0,
      );

    return {
      totalShipments,
      totalBilled: Math.round(totalBilled * 100) / 100,
      collectedOrigin: Math.round(originPayments * 100) / 100,
      collectedDestination: Math.round(destinationPayments * 100) / 100,
      statusCounts,
      activeBranches: branchesCount,
      activeRoutes: routesCount,
      activeUsers: usersCount,
      totalCustomers: customersCount,
    };
  }

  // --- USUARIOS Y PERMISOS ---

  listUsers(query?: string) {
    const q = query?.trim();
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { ci: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { fullName: 'asc' },
      select: userSelect,
    });
  }

  async createUser(dto: CreateUserDto) {
    const ci = dto.ci.trim();
    const [exists, branch] = await Promise.all([
      this.prisma.user.findUnique({ where: { ci } }),
      this.prisma.branch.findUnique({ where: { id: dto.branchId } }),
    ]);
    if (exists) throw new ConflictException('Ya existe un usuario con ese C.I.');
    if (!branch) throw new NotFoundException('Sucursal no encontrada.');
    return this.prisma.user.create({
      data: {
        branchId: dto.branchId,
        fullName: dto.fullName.trim(),
        ci,
        role: dto.role,
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
      select: userSelect,
    });
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (dto.ci && dto.ci.trim() !== user.ci) {
      const ciConflict = await this.prisma.user.findUnique({
        where: { ci: dto.ci.trim() },
      });
      if (ciConflict) {
        throw new ConflictException('Ese C.I. ya está asignado a otro usuario.');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.ci ? { ci: dto.ci.trim() } : {}),
        branchId: dto.branchId,
        role: dto.role,
        isActive: dto.isActive,
        ...(dto.password
          ? { passwordHash: await bcrypt.hash(dto.password, 12) }
          : {}),
      },
      select: userSelect,
    });
  }

  async deleteUser(id: string, currentUserId: string) {
    if (currentUserId === id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const used = await this.prisma.shipment.count({
      where: { OR: [{ dispatchedByUserId: id }, { deliveredByUserId: id }] },
    });
    if (used > 0) {
      await this.prisma.user.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, deactivated: true };
    }
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }

  // --- SUCURSALES ---

  listBranches() {
    return this.prisma.branch.findMany({ orderBy: { code: 'asc' } });
  }

  async createBranch(dto: CreateBranchDto) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.branch.findUnique({
      where: { code },
    });
    if (exists) {
      throw new ConflictException('Ya existe una sucursal con ese código.');
    }
    return this.prisma.branch.create({
      data: {
        ...dto,
        code,
        name: dto.name.trim(),
        department: dto.department.trim(),
        address: dto.address.trim(),
      },
    });
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada.');
    if (dto.code && dto.code.trim().toUpperCase() !== branch.code) {
      const conflict = await this.prisma.branch.findUnique({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (conflict) {
        throw new ConflictException('Ya existe otra sucursal con ese código.');
      }
    }
    return this.prisma.branch.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      },
    });
  }

  async deleteBranch(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada.');
    const [users, shipments] = await Promise.all([
      this.prisma.user.count({ where: { branchId: id } }),
      this.prisma.shipment.count({
        where: { OR: [{ originBranchId: id }, { destinationBranchId: id }] },
      }),
    ]);
    if (users > 0 || shipments > 0) {
      await this.prisma.branch.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, deactivated: true };
    }
    await this.prisma.route.deleteMany({
      where: { OR: [{ originBranchId: id }, { destinationBranchId: id }] },
    });
    await this.prisma.branch.delete({ where: { id } });
    return { deleted: true, deactivated: false };
  }

  // --- RUTAS Y TARIFAS ---

  listRoutes() {
    return this.prisma.route.findMany({
      orderBy: [
        { originBranch: { code: 'asc' } },
        { destinationBranch: { code: 'asc' } },
      ],
      include: routeInclude,
    });
  }

  async createRoute(dto: CreateRouteDto) {
    if (dto.originBranchId === dto.destinationBranchId) {
      throw new BadRequestException(
        'Origen y destino deben ser sucursales distintas.',
      );
    }
    const [origin, destination, duplicate] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: dto.originBranchId } }),
      this.prisma.branch.findUnique({ where: { id: dto.destinationBranchId } }),
      this.prisma.route.findUnique({
        where: {
          originBranchId_destinationBranchId: {
            originBranchId: dto.originBranchId,
            destinationBranchId: dto.destinationBranchId,
          },
        },
      }),
    ]);
    if (!origin || !destination) {
      throw new NotFoundException('Una de las sucursales indicadas no existe.');
    }
    if (duplicate) {
      throw new ConflictException(
        'Ya existe una ruta configurada para ese origen y destino.',
      );
    }
    return this.prisma.route.create({
      data: {
        originBranchId: dto.originBranchId,
        destinationBranchId: dto.destinationBranchId,
        basePrice: dto.basePrice,
        pricePerKg: dto.pricePerKg ?? 0,
        estimatedHours: dto.estimatedHours ?? null,
      },
      include: routeInclude,
    });
  }

  async updateRoute(id: string, dto: UpdateRouteDto) {
    const route = await this.prisma.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundException('Ruta no encontrada.');
    const nextOrigin = dto.originBranchId ?? route.originBranchId;
    const nextDestination = dto.destinationBranchId ?? route.destinationBranchId;
    if (nextOrigin === nextDestination) {
      throw new BadRequestException(
        'Origen y destino deben ser sucursales distintas.',
      );
    }
    return this.prisma.route.update({
      where: { id },
      data: dto,
      include: routeInclude,
    });
  }

  async deleteRoute(id: string) {
    const route = await this.prisma.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundException('Ruta no encontrada.');
    await this.prisma.route.delete({ where: { id } });
    return { deleted: true };
  }

  // --- CLIENTES ---

  listCustomers(query?: string) {
    const q = query?.trim();
    return this.prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { ciNit: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { fullName: 'asc' },
      take: 150,
    });
  }

  async createCustomer(dto: AdminCustomerDto) {
    const ciNit = dto.ciNit?.trim() || null;
    if (ciNit) {
      const existing = await this.prisma.customer.findUnique({
        where: { ciNit },
      });
      if (existing) {
        throw new ConflictException('Ya existe un cliente con ese C.I./NIT.');
      }
    }
    return this.prisma.customer.create({
      data: {
        ciNit,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        isCorporateAccount: dto.isCorporateAccount ?? false,
        corporateCreditLimit: dto.corporateCreditLimit ?? 0,
      },
    });
  }

  async updateCustomer(id: string, dto: AdminCustomerDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado.');
    const ciNit = dto.ciNit?.trim() || null;
    if (ciNit && ciNit !== customer.ciNit) {
      const conflict = await this.prisma.customer.findUnique({
        where: { ciNit },
      });
      if (conflict) {
        throw new ConflictException('Ese C.I./NIT ya pertenece a otro cliente.');
      }
    }
    return this.prisma.customer.update({
      where: { id },
      data: {
        ciNit,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        isCorporateAccount:
          dto.isCorporateAccount ?? customer.isCorporateAccount,
        corporateCreditLimit:
          dto.corporateCreditLimit ?? customer.corporateCreditLimit,
      },
    });
  }

  async deleteCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado.');
    const used = await this.prisma.shipment.count({
      where: { OR: [{ senderId: id }, { consigneeId: id }] },
    });
    if (used > 0) {
      throw new ConflictException(
        'No se puede eliminar el cliente porque tiene encomiendas asociadas.',
      );
    }
    await this.prisma.customer.delete({ where: { id } });
    return { deleted: true };
  }

  // --- CONTROL GLOBAL DE ENCOMIENDAS ---

  listShipments(filters: {
    q?: string;
    status?: string;
    branchId?: string;
    paymentType?: string;
  }) {
    const q = filters.q?.trim();
    const where: Prisma.ShipmentWhereInput = {
      ...(filters.status
        ? { status: filters.status as ShipmentStatus }
        : {}),
      ...(filters.paymentType
        ? { paymentType: filters.paymentType as PaymentType }
        : {}),
      ...(filters.branchId
        ? {
            OR: [
              { originBranchId: filters.branchId },
              { destinationBranchId: filters.branchId },
            ],
          }
        : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { guideNumber: { contains: q, mode: 'insensitive' } },
                  {
                    sender: { fullName: { contains: q, mode: 'insensitive' } },
                  },
                  {
                    consignee: {
                      fullName: { contains: q, mode: 'insensitive' },
                    },
                  },
                  { consignee: { ciNit: { contains: q, mode: 'insensitive' } } },
                ],
              },
            ],
          }
        : {}),
    };

    return this.prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: shipmentInclude,
    });
  }

  async updateShipment(
    id: string,
    dto: AdminUpdateShipmentDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id } });
      if (!shipment) throw new NotFoundException('Encomienda no encontrada.');

      const nextOrigin = dto.originBranchId ?? shipment.originBranchId;
      const nextDestination =
        dto.destinationBranchId ?? shipment.destinationBranchId;
      if (nextOrigin === nextDestination) {
        throw new BadRequestException(
          'La sucursal de origen y destino deben ser distintas.',
        );
      }

      const nextStatus = dto.status ?? shipment.status;
      const statusChanged = nextStatus !== shipment.status;
      const nextPaid = dto.isPaid ?? shipment.isPaid;
      const nextAmount =
        dto.totalAmount !== undefined
          ? dto.totalAmount
          : Number(shipment.totalAmount);

      if (!shipment.isPaid && nextPaid) {
        const moment =
          nextStatus === ShipmentStatus.ENTREGADO ||
          nextStatus === ShipmentStatus.EN_SUCURSAL_DESTINO
            ? PaymentMoment.DESTINO
            : PaymentMoment.ORIGEN;
        const targetBranch =
          moment === PaymentMoment.DESTINO ? nextDestination : nextOrigin;

        await tx.payment.create({
          data: {
            shipmentId: shipment.id,
            branchId: targetBranch,
            userId: actor.userId,
            amount: nextAmount,
            moment,
          },
        });
      }

      return tx.shipment.update({
        where: { id },
        data: {
          originBranchId: nextOrigin,
          destinationBranchId: nextDestination,
          status: nextStatus,
          paymentType: dto.paymentType ?? shipment.paymentType,
          isPaid: nextPaid,
          totalAmount: nextAmount,
          ...(dto.receiverCiVerified !== undefined
            ? { receiverCiVerified: dto.receiverCiVerified || null }
            : {}),
          ...(dto.deliveryNotes !== undefined
            ? { deliveryNotes: dto.deliveryNotes || null }
            : {}),
          ...(dto.cancelReason !== undefined
            ? { cancelReason: dto.cancelReason || null }
            : {}),
          ...(statusChanged && nextStatus === ShipmentStatus.EN_SUCURSAL_DESTINO
            ? { arrivedAt: shipment.arrivedAt ?? new Date() }
            : {}),
          ...(statusChanged && nextStatus === ShipmentStatus.ENTREGADO
            ? {
                deliveredAt: shipment.deliveredAt ?? new Date(),
                deliveredByUserId: actor.userId,
              }
            : {}),
          ...(statusChanged && nextStatus === ShipmentStatus.ANULADO
            ? { cancelledAt: new Date() }
            : {}),
          ...(statusChanged
            ? {
                statusLogs: {
                  create: {
                    previousStatus: shipment.status,
                    newStatus: nextStatus,
                    changedByUserId: actor.userId,
                    branchId: actor.branchId,
                    remarks:
                      dto.remarks?.trim() ||
                      `Estado actualizado por administración a ${nextStatus}.`,
                  },
                },
              }
            : {}),
        },
        include: shipmentInclude,
      });
    });
  }

  async deleteShipment(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id } });
      if (!shipment) throw new NotFoundException('Encomienda no encontrada.');
      await tx.payment.deleteMany({ where: { shipmentId: id } });
      await tx.shipmentStatusLog.deleteMany({ where: { shipmentId: id } });
      await tx.shipmentItem.deleteMany({ where: { shipmentId: id } });
      await tx.shipment.delete({ where: { id } });
      return { deleted: true };
    });
  }
}
