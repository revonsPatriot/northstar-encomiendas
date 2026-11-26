import { Module } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [ShipmentsModule],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
