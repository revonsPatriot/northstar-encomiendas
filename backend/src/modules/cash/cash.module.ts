import { Module } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [ShipmentsModule],
  controllers: [CashController],
  providers: [CashService],
})
export class CashModule {}
