import type {
  Branch,
  CashClosing,
  CashSummary,
  Customer,
  DashboardStats,
  Paginated,
  PaymentType,
  PublicOverview,
  PublicTracking,
  Route,
  Shipment,
  ShipmentItem,
  ShipmentStatus,
} from '../../../shared/types/shipment.types';
import { apiFetch } from './api-client';

export interface RegisterShipmentRequest {
  originBranchId: string;
  destinationBranchId: string;
  sender: Customer;
  consignee: Customer;
  paymentType: PaymentType;
  totalAmount: number;
  items: ShipmentItem[];
  clientRequestId?: string;
}

function clean<T extends Customer>(customer: T): Customer {
  return {
    ciNit: customer.ciNit?.trim() || undefined,
    fullName: customer.fullName.trim(),
    phone: customer.phone?.trim() || undefined,
  };
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function listBranches(): Promise<Branch[]> {
  return apiFetch<Branch[]>('/branches');
}

export function listRoutes(): Promise<Route[]> {
  return apiFetch<Route[]>('/branches/routes');
}

export function getPublicOverview(): Promise<PublicOverview> {
  return apiFetch<PublicOverview>('/branches/overview');
}

export function searchCustomers(query: string): Promise<Customer[]> {
  return apiFetch<Customer[]>(`/customers/search?q=${encodeURIComponent(query)}`);
}

export function registerShipment(
  request: RegisterShipmentRequest,
): Promise<Shipment> {
  return apiFetch<Shipment>('/shipments', {
    method: 'POST',
    body: JSON.stringify({
      ...request,
      sender: clean(request.sender),
      consignee: clean(request.consignee),
      items: request.items.map((item) => ({
        quantity: Number(item.quantity),
        description: item.description.trim(),
        weightKg: item.weightKg ? Number(item.weightKg) : undefined,
        subtotal: Number(item.subtotal),
      })),
    }),
  });
}

export function listDestinationShipments(
  branchId: string,
  query?: string,
  skip = 0,
): Promise<Paginated<Shipment>> {
  return apiFetch(`/shipments/branch/${branchId}${qs({ q: query, skip })}`);
}

export function listIncomingShipments(
  branchId: string,
  query?: string,
  skip = 0,
): Promise<Paginated<Shipment>> {
  return apiFetch(`/shipments/incoming/${branchId}${qs({ q: query, skip })}`);
}

export function listOutgoingShipments(
  branchId: string,
  options: { status?: ShipmentStatus; query?: string; skip?: number } = {},
): Promise<Paginated<Shipment>> {
  return apiFetch(
    `/shipments/outgoing/${branchId}${qs({
      status: options.status,
      q: options.query,
      skip: options.skip,
    })}`,
  );
}

export function dispatchShipment(guideNumber: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${guideNumber}/dispatch`, { method: 'PATCH' });
}

export function arriveShipment(guideNumber: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${guideNumber}/arrive`, { method: 'PATCH' });
}

export function cancelShipment(guideNumber: string, reason: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${guideNumber}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export function confirmDelivery(
  guideNumber: string,
  receiverCi: string,
  payOnDelivery: boolean,
  notes?: string,
): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${guideNumber}/deliver`, {
    method: 'PATCH',
    body: JSON.stringify({ receiverCi, payOnDelivery, notes: notes || undefined }),
  });
}

export function trackShipment(guideNumber: string): Promise<PublicTracking> {
  return apiFetch<PublicTracking>(`/public/track/${encodeURIComponent(guideNumber.trim())}`);
}

export function getDashboard(branchId?: string): Promise<DashboardStats> {
  return apiFetch<DashboardStats>(`/cash/dashboard${qs({ branchId })}`);
}

export function getCashSummary(date?: string, branchId?: string): Promise<CashSummary> {
  return apiFetch<CashSummary>(`/cash/summary${qs({ date, branchId })}`);
}

export function listCashClosings(branchId?: string): Promise<CashClosing[]> {
  return apiFetch<CashClosing[]>(`/cash/closings${qs({ branchId })}`);
}

export function closeCash(
  countedCash: number,
  notes: string,
  date?: string,
  branchId?: string,
): Promise<CashClosing> {
  return apiFetch<CashClosing>('/cash/closings', {
    method: 'POST',
    body: JSON.stringify({
      countedCash,
      notes: notes || undefined,
      date,
      branchId,
    }),
  });
}
