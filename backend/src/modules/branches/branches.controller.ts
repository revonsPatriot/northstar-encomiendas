import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../shipments/infrastructure/persistence/prisma.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
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
}