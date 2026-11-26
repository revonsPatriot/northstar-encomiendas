import type {
  AdminOverview,
  Customer,
  ReportPeriod,
  ShipmentReport,
  PaymentType,
  Route,
  Shipment,
  ShipmentStatus,
  UserRole,
} from '../../../shared/types/shipment.types';
import { apiFetch } from './api-client';

export interface AdminUser {
  id: string;
  fullName: string;
  ci: string;
  role: UserRole;
  isActive: boolean;
  branchId: string;
  branch: { name: string; code: string };
}

export interface AdminBranch {
  id: string;
  code: string;
  name: string;
  department: string;
  address: string;
  phones?: string | null;
  isActive: boolean;
  isOwnOffice: boolean;
}

export type AdminRoute = Route;

export interface AdminCustomer extends Customer {
  id: string;
  isCorporateAccount: boolean;
  corporateCreditLimit: number | string;
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, v);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// --- RESUMEN GLOBAL ---
export const getAdminOverview = () => apiFetch<AdminOverview>('/admin/overview');

// --- USUARIOS Y PERMISOS ---
export const listUsers = (q?: string) =>
  apiFetch<AdminUser[]>(`/admin/users${qs({ q })}`);

export const createUser = (body: {
  branchId: string;
  fullName: string;
  ci: string;
  role: AdminUser['role'];
  password: string;
}) => apiFetch<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(body) });

export const updateUser = (
  id: string,
  body: Partial<{
    fullName: string;
    ci: string;
    branchId: string;
    role: AdminUser['role'];
    isActive: boolean;
    password: string;
  }>,
) => apiFetch<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteUser = (id: string) =>
  apiFetch<{ deleted: boolean; deactivated: boolean }>(`/admin/users/${id}`, {
    method: 'DELETE',
  });

// --- SUCURSALES ---
export const listAdminBranches = () => apiFetch<AdminBranch[]>('/admin/branches');

export const createBranch = (body: {
  code: string;
  name: string;
  department: string;
  address: string;
  phones?: string;
  isOwnOffice?: boolean;
}) => apiFetch<AdminBranch>('/admin/branches', { method: 'POST', body: JSON.stringify(body) });

export const updateBranch = (
  id: string,
  body: Partial<{
    code: string;
    name: string;
    department: string;
    address: string;
    phones: string;
    isOwnOffice: boolean;
    isActive: boolean;
  }>,
) => apiFetch<AdminBranch>(`/admin/branches/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteBranch = (id: string) =>
  apiFetch<{ deleted: boolean; deactivated: boolean }>(`/admin/branches/${id}`, {
    method: 'DELETE',
  });

// --- RUTAS Y TARIFAS ---
export const listAdminRoutes = () => apiFetch<AdminRoute[]>('/admin/routes');

export const createRoute = (body: {
  originBranchId: string;
  destinationBranchId: string;
  basePrice: number;
  pricePerKg?: number;
  estimatedHours?: number;
}) => apiFetch<AdminRoute>('/admin/routes', { method: 'POST', body: JSON.stringify(body) });

export const updateRoute = (
  id: string,
  body: Partial<{
    originBranchId: string;
    destinationBranchId: string;
    basePrice: number;
    pricePerKg: number;
    estimatedHours: number | null;
    isActive: boolean;
  }>,
) => apiFetch<AdminRoute>(`/admin/routes/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteRoute = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/admin/routes/${id}`, { method: 'DELETE' });

// --- CLIENTES ---
export const listAdminCustomers = (q?: string) =>
  apiFetch<AdminCustomer[]>(`/admin/customers${qs({ q })}`);

export const createCustomer = (body: {
  ciNit?: string;
  fullName: string;
  phone?: string;
  isCorporateAccount?: boolean;
  corporateCreditLimit?: number;
}) => apiFetch<AdminCustomer>('/admin/customers', { method: 'POST', body: JSON.stringify(body) });

export const updateCustomer = (
  id: string,
  body: {
    ciNit?: string;
    fullName: string;
    phone?: string;
    isCorporateAccount?: boolean;
    corporateCreditLimit?: number;
  },
) => apiFetch<AdminCustomer>(`/admin/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteCustomer = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/admin/customers/${id}`, { method: 'DELETE' });

// --- CONTROL GLOBAL DE ENCOMIENDAS ---
export const listAdminShipments = (
  filters: {
    q?: string;
    status?: string;
    branchId?: string;
    paymentType?: string;
  } = {},
) => apiFetch<Shipment[]>(`/admin/shipments${qs(filters)}`);

export const updateAdminShipment = (
  id: string,
  body: Partial<{
    originBranchId: string;
    destinationBranchId: string;
    status: ShipmentStatus;
    paymentType: PaymentType;
    isPaid: boolean;
    totalAmount: number;
    receiverCiVerified: string;
    deliveryNotes: string;
    cancelReason: string;
    remarks: string;
  }>,
) => apiFetch<Shipment>(`/admin/shipments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteAdminShipment = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/admin/shipments/${id}`, { method: 'DELETE' });

// --- REPORTES ---
export const getShipmentReport = (params: {
  period: ReportPeriod;
  date?: string;
  branchId?: string;
}) =>
  apiFetch<ShipmentReport>(
    `/admin/reports${qs({
      period: params.period,
      date: params.date,
      branchId: params.branchId,
    })}`,
  );
