import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../shipments/infrastructure/persistence/prisma.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard)
  search(@Query('q') query?: string) {
    const q = query?.trim();
    if (!q) {
      return [];
    }

    return this.prisma.customer.findMany({
      where: {
        OR: [
          { ciNit: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { fullName: 'asc' },
      take: 10,
      select: {
        id: true,
        ciNit: true,
        fullName: true,
        phone: true,
        isCorporateAccount: true,
      },
    });
  }
}