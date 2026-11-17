export interface InvoiceRequest {
  customerCiNit: string;
  customerName: string;
  amount: number;
  description: string;
}

export interface InvoiceResult {
  invoiceId: string;
  status: 'ISSUED' | 'PENDING';
}

export interface IInvoicingProvider {
  issueInvoice(request: InvoiceRequest): Promise<InvoiceResult>;
}

export const INVOICING_PROVIDER = Symbol('INVOICING_PROVIDER');