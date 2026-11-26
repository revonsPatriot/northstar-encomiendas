export type ShipmentStatus =
  | 'REGISTRADO'
  | 'EN_TRANSITO'
  | 'EN_SUCURSAL_DESTINO'
  | 'ENTREGADO'
  | 'ANULADO';

export type PaymentType =
  | 'PAGADO_ORIGEN'
  | 'POR_PAGAR'
  | 'CUENTA_CORPORATIVA';

export type UserRole = 'ADMIN_CENTRAL' | 'ENCARGADO_SUCURSAL' | 'OPERADOR';

export interface Branch {
  id: string;
  code: string;
  name: string;
  department: string;
  address: string;
  phones?: string | null;
  isOwnOffice: boolean;
  isActive?: boolean;
}

export interface Customer {
  id?: string;
  ciNit?: string | null;
  fullName: string;
  phone?: string | null;
  isCorporateAccount?: boolean;
  corporateCreditLimit?: number | string;
}

export interface Route {
  id: string;
  originBranchId: string;
  destinationBranchId: string;
  basePrice: number | string;
  pricePerKg: number | string;
  estimatedHours?: number | null;
  isActive?: boolean;
  originBranch?: Pick<Branch, 'id' | 'code' | 'name' | 'department'>;
  destinationBranch?: Pick<Branch, 'id' | 'code' | 'name' | 'department'>;
}

export interface ShipmentItem {
  id?: string;
  quantity: number;
  description: string;
  weightKg?: number | null;
  subtotal: number;
}

export interface ShipmentStatusLogEntry {
  id: string;
  previousStatus?: ShipmentStatus | null;
  newStatus: ShipmentStatus;
  remarks?: string | null;
  createdAt: string;
  branch?: { code: string; name: string };
  changedByUser?: { fullName: string };
}

export interface Shipment {
  id: string;
  guideNumber: string;
  originBranchId: string;
  destinationBranchId: string;
  status: ShipmentStatus;
  paymentType: PaymentType;
  isPaid: boolean;
  totalAmount: number | string;
  originBranch?: Branch;
  destinationBranch?: Branch;
  sender: Customer;
  consignee: Customer;
  items: ShipmentItem[];
  statusLogs?: ShipmentStatusLogEntry[];
  createdAt?: string;
  arrivedAt?: string | null;
  deliveredAt?: string | null;
  receiverCiVerified?: string | null;
  deliveryNotes?: string | null;
  cancelReason?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  take: number;
  skip: number;
}

export interface PublicTracking {
  guideNumber: string;
  status: ShipmentStatus;
  createdAt: string;
  deliveredAt?: string | null;
  originBranch: { name: string; department: string };
  destinationBranch: { name: string; department: string };
  consigneeName: string;
  history: Array<{ status: ShipmentStatus; at: string; branch: string }>;
}

export interface PublicOverview {
  branches: Branch[];
  routes: Route[];
  metrics: {
    activeBranches: number;
    activeRoutes: number;
    departmentsCovered: number;
    totalShipments: number;
    deliveredShipments: number;
  };
}

export interface AdminOverview {
  totalShipments: number;
  totalBilled: number;
  collectedOrigin: number;
  collectedDestination: number;
  statusCounts: Record<ShipmentStatus, number>;
  activeBranches: number;
  activeRoutes: number;
  activeUsers: number;
  totalCustomers: number;
}

export interface AuthUser {
  id: string;
  branchId: string;
  ci: string;
  fullName: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface DashboardStats {
  registeredToday: number;
  readyForDelivery: number;
  incoming: number;
  outgoingPending: number;
  cashToday: number;
}

export interface CashClosing {
  id: string;
  closingDate: string;
  expectedOrigin: number | string;
  expectedDestination: number | string;
  countedCash: number | string;
  difference: number | string;
  notes?: string | null;
  createdAt: string;
  user?: { fullName: string };
}

export interface CashSummary {
  date: string;
  branchId: string;
  origin: { amount: number; count: number };
  destination: { amount: number; count: number };
  expectedTotal: number;
  closing: CashClosing | null;
}

export type ReportPeriod = 'day' | 'week' | 'month';

export interface ReportRow {
  guideNumber: string;
  createdAt: string;
  origin: string;
  destination: string;
  sender: string;
  consignee: string;
  status: ShipmentStatus;
  paymentType: PaymentType;
  isPaid: boolean;
  totalAmount: number;
  weightKg: number;
}

export interface ShipmentReport {
  period: ReportPeriod;
  from: string;
  to: string;
  label: string;
  generatedAt: string;
  branchId: string | null;
  truncated: boolean;
  totals: {
    shipments: number;
    cancelled: number;
    delivered: number;
    inTransit: number;
    billed: number;
    paidAmount: number;
    pendingAmount: number;
    weightKg: number;
    averageTicket: number;
  };
  previous: { shipments: number; billed: number };
  byStatus: Record<ShipmentStatus, number>;
  byPayment: Array<{ paymentType: PaymentType; count: number; amount: number }>;
  series: Array<{ key: string; label: string; count: number; amount: number }>;
  byOrigin: Array<{ code: string; name: string; count: number; amount: number }>;
  topRoutes: Array<{ route: string; count: number; amount: number }>;
  collected: { origin: number; destination: number };
  rows: ReportRow[];
}

export interface AccountProfile {
  id: string;
  branchId: string;
  ci: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  branch: { name: string; code: string };
}

export interface AccountActivity {
  emittedToday: number;
  emittedTotal: number;
  deliveredTotal: number;
  collectedToday: number;
  recent: Array<{
    guideNumber: string;
    status: ShipmentStatus;
    totalAmount: number;
    createdAt: string;
    originCode: string;
    destinationCode: string;
    consigneeName: string;
  }>;
}
