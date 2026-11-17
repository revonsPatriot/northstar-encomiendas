import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shipments/infrastructure/persistence/prisma.service';

export interface AuthenticatedUser {
  userId: string;
  branchId: string;
  ci: string;
  fullName: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(ci: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { ci },
    });

    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('C.I. o contraseña incorrectos.');
    }

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
}