import { Module } from '@nestjs/common';
import { AdminModule } from './modules/admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CashModule } from './modules/cash/cash.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';

@Module({
  imports: [
    ShipmentsModule,
    AuthModule,
    BranchesModule,
    CustomersModule,
    BillingModule,
    CashModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
