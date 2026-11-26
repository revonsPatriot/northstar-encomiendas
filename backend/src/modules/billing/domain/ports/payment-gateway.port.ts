export interface PaymentRequest {
  amount: number;
  currency: 'BOB';
  description: string;
  externalReference: string;
}

export interface PaymentResult {
  paymentId: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  checkoutUrl?: string;
}

export interface IPaymentGateway {
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');