import { Module } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { BranchesController } from './branches.controller';

@Module({
  imports: [ShipmentsModule],
  controllers: [BranchesController],
})
export class BranchesModule {}