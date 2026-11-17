import { Module } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { CustomersController } from './customers.controller';

@Module({
  imports: [ShipmentsModule],
  controllers: [CustomersController],
})
export class CustomersModule {}