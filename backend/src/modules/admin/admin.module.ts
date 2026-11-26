import { Module } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportsService } from './reports/reports.service';

@Module({
  imports: [ShipmentsModule],
  controllers: [AdminController],
  providers: [AdminService, ReportsService],
})
export class AdminModule {}
