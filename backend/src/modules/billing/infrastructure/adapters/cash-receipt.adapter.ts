import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  IPaymentGateway,
  PaymentRequest,
  PaymentResult,
} from '../../domain/ports/payment-gateway.port';

@Injectable()
export class CashReceiptAdapter implements IPaymentGateway {
  createPayment(request: PaymentRequest): Promise<PaymentResult> {
    return Promise.resolve({
      paymentId: `CASH-${request.externalReference}`,
      status: 'PAID',
    });
  }

  getPaymentStatus(): Promise<PaymentResult> {
    throw new NotImplementedException(
      'El estado de pagos en efectivo se confirma desde la operación de entrega.',
    );
  }
}