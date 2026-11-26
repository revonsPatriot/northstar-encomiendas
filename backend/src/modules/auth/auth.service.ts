import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { todayInBolivia } from '../cash/date.util';
import { PrismaService } from '../shipments/infrastructure/persistence/prisma.service';

export interface AuthenticatedUser {
  userId: string;
  branchId: string;
  ci: string;
  fullName: string;
  role: UserRole;
}

const DUMMY_HASH = bcrypt.hashSync('northstar-dummy-password', 12);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(ci: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { ci: ci.trim() },
    });

    const valid = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !user.isActive || !valid) {
      throw new UnauthorizedException('C.I. o contraseña incorrectos.');
    }

    return this.issueSession(user);
  }

  async register(input: {
    branchId: string;
    fullName: string;
    ci: string;
    password: string;
    role?: UserRole;
    accessCode?: string;
  }) {
    const role = input.role ?? UserRole.OPERADOR;
    if (role !== UserRole.OPERADOR) {
      // Los roles con más permisos requieren un código de autorización interno.
      const expected = process.env.STAFF_REGISTRATION_CODE;
      if (!expected || input.accessCode !== expected) {
        throw new ForbiddenException(
          'Se requiere un código de autorización válido para registrar este rol.',
        );
      }
    }

    const ci = input.ci.trim();
    const [existing, branch] = await Promise.all([
      this.prisma.user.findUnique({ where: { ci } }),
      this.prisma.branch.findFirst({
        where: { id: input.branchId, isActive: true },
      }),
    ]);

    if (existing) {
      throw new ConflictException('Ya existe una cuenta registrada con ese C.I.');
    }
    if (!branch) {
      throw new NotFoundException('La sucursal seleccionada no está disponible.');
    }

    const user = await this.prisma.user.create({
      data: {
        branchId: branch.id,
        fullName: input.fullName.trim(),
        ci,
        role,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
    });

    return this.issueSession(user);
  }

  private async issueSession(user: {
    id: string;
    branchId: string;
    ci: string;
    fullName: string;
    role: UserRole;
  }) {
    const payload: AuthenticatedUser = {
      userId: user.id,
      branchId: user.branchId,
      ci: user.ci,
      fullName: user.fullName,
      role: user.role,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        branchId: user.branchId,
        ci: user.ci,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        branchId: true,
        ci: true,
        fullName: true,
        role: true,
        isActive: true,
        branch: { select: { name: true, code: true } },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('La sesión ya no es válida.');
    }
    return user;
  }

  /** Actividad personal del usuario autenticado (página «Mi cuenta»). */
  async activity(userId: string) {
    const todayStart = new Date(`${todayInBolivia()}T00:00:00.000-04:00`);

    const [emittedToday, emittedTotal, deliveredTotal, collected, recent] =
      await Promise.all([
        this.prisma.shipment.count({
          where: { dispatchedByUserId: userId, createdAt: { gte: todayStart } },
        }),
        this.prisma.shipment.count({ where: { dispatchedByUserId: userId } }),
        this.prisma.shipment.count({ where: { deliveredByUserId: userId } }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { userId, createdAt: { gte: todayStart } },
        }),
        this.prisma.shipment.findMany({
          where: { dispatchedByUserId: userId },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            guideNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            originBranch: { select: { code: true } },
            destinationBranch: { select: { code: true } },
            consignee: { select: { fullName: true } },
          },
        }),
      ]);

    return {
      emittedToday,
      emittedTotal,
      deliveredTotal,
      collectedToday: Number(collected._sum.amount ?? 0),
      recent: recent.map((shipment) => ({
        guideNumber: shipment.guideNumber,
        status: shipment.status,
        totalAmount: Number(shipment.totalAmount),
        createdAt: shipment.createdAt.toISOString(),
        originCode: shipment.originBranch.code,
        destinationCode: shipment.destinationBranch.code,
        consigneeName: shipment.consignee.fullName,
      })),
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('La contraseña actual es incorrecta.');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta de la actual.',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
    return { ok: true };
  }
}
