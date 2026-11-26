import { Module } from '@nestjs/common';
import {
  PAYMENT_GATEWAY,
} from './domain/ports/payment-gateway.port';
import { CashReceiptAdapter } from './infrastructure/adapters/cash-receipt.adapter';

@Module({
  providers: [
    CashReceiptAdapter,
    {
      provide: PAYMENT_GATEWAY,
      useExisting: CashReceiptAdapter,
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class BillingModule {}