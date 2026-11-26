import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Edit3,
  FileText,
  KeyRound,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Trash2,
  Truck,
  Unlock,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AdminOverview,
  PaymentType,
  Shipment,
  ShipmentStatus,
} from '../../../../shared/types/shipment.types';
import { getSessionUser } from '../../services/api-client';
import ReportsPanel from './ReportsPanel';
import {
  createBranch,
  createCustomer,
  createRoute,
  createUser,
  deleteAdminShipment,
  deleteBranch,
  deleteCustomer,
  deleteRoute,
  deleteUser,
  getAdminOverview,
  listAdminBranches,
  listAdminCustomers,
  listAdminRoutes,
  listAdminShipments,
  listUsers,
  updateAdminShipment,
  updateBranch,
  updateCustomer,
  updateRoute,
  updateUser,
  type AdminBranch,
  type AdminCustomer,
  type AdminRoute,
  type AdminUser,
} from '../../services/admin.service';

const input = 'ns-input';
const iconBtn =
  'btn-tactile inline-flex items-center gap-1.5 border border-white/15 bg-[#060709] px-2.5 py-1.5 text-xs font-bold uppercase hover:border-[#FFB800] hover:text-[#FFB800] disabled:opacity-40';
const dangerBtn =
  'btn-tactile inline-flex items-center gap-1.5 border border-red-500/35 bg-[#060709] px-2.5 py-1.5 text-xs font-bold uppercase text-red-300 hover:border-red-400 disabled:opacity-40';

const roles: Array<{ value: AdminUser['role']; label: string }> = [
  { value: 'OPERADOR', label: 'OPERADOR' },
  { value: 'ENCARGADO_SUCURSAL', label: 'ENCARGADO' },
  { value: 'ADMIN_CENTRAL', label: 'ADMIN CENTRAL' },
];

const statusLabels: Record<ShipmentStatus, string> = {
  REGISTRADO: 'ORIGEN',
  EN_TRANSITO: 'EN RUTA',
  EN_SUCURSAL_DESTINO: 'EN DESTINO',
  ENTREGADO: 'ENTREGADO',
  ANULADO: 'ANULADO',
};

const paymentLabels: Record<PaymentType, string> = {
  PAGADO_ORIGEN: 'ORIGEN',
  POR_PAGAR: 'POR PAGAR',
  CUENTA_CORPORATIVA: 'CORPORATIVO',
};

type Tab = 'encomiendas' | 'usuarios' | 'sucursales' | 'rutas' | 'clientes' | 'reportes';

export default function AdminIsland() {
  const me = getSessionUser<{ id: string; role: string }>();
  const [tab, setTab] = useState<Tab>('encomiendas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');

  const [editingShipment, setEditingShipment] = useState<{
    id: string;
    guideNumber: string;
    originBranchId: string;
    destinationBranchId: string;
    status: ShipmentStatus;
    paymentType: PaymentType;
    isPaid: boolean;
    totalAmount: string;
    receiverCiVerified: string;
    deliveryNotes: string;
    remarks: string;
  } | null>(null);

  const [userForm, setUserForm] = useState({
    branchId: '',
    fullName: '',
    ci: '',
    role: 'OPERADOR' as AdminUser['role'],
    password: '',
  });
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const [branchForm, setBranchForm] = useState({
    code: '',
    name: '',
    department: '',
    address: '',
    phones: '',
    isOwnOffice: true,
  });
  const [editingBranch, setEditingBranch] = useState<AdminBranch | null>(null);

  const [routeForm, setRouteForm] = useState({
    originBranchId: '',
    destinationBranchId: '',
    basePrice: '',
    pricePerKg: '0',
    estimatedHours: '',
  });
  const [editingRoute, setEditingRoute] = useState<AdminRoute | null>(null);

  const [customerForm, setCustomerForm] = useState({
    fullName: '',
    ciNit: '',
    phone: '',
    isCorporateAccount: false,
    corporateCreditLimit: '0',
  });
  const [editingCustomer, setEditingCustomer] = useState<AdminCustomer | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, s, u, b, r, c] = await Promise.all([
        getAdminOverview(),
        listAdminShipments(),
        listUsers(),
        listAdminBranches(),
        listAdminRoutes(),
        listAdminCustomers(),
      ]);
      setOverview(ov);
      setShipments(s);
      setUsers(u);
      setBranches(b);
      setRoutes(r);
      setCustomers(c);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Error de sincronización.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me?.role === 'ADMIN_CENTRAL') void load();
  }, [load, me?.role]);

  const q = search.trim().toLowerCase();

  const filteredShipments = useMemo(
    () =>
      shipments.filter((s) => {
        if (statusFilter && s.status !== statusFilter) return false;
        if (
          branchFilter &&
          s.originBranchId !== branchFilter &&
          s.destinationBranchId !== branchFilter
        ) {
          return false;
        }
        if (!q) return true;
        return (
          s.guideNumber.toLowerCase().includes(q) ||
          s.sender.fullName.toLowerCase().includes(q) ||
          s.consignee.fullName.toLowerCase().includes(q) ||
          (s.consignee.ciNit ?? '').toLowerCase().includes(q)
        );
      }),
    [shipments, statusFilter, branchFilter, q],
  );

  const filteredUsers = useMemo(
    () =>
      !q
        ? users
        : users.filter(
          (u) =>
            u.fullName.toLowerCase().includes(q) ||
            u.ci.toLowerCase().includes(q) ||
            u.branch.name.toLowerCase().includes(q),
        ),
    [users, q],
  );

  const filteredBranches = useMemo(
    () =>
      !q
        ? branches
        : branches.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.code.toLowerCase().includes(q) ||
            b.department.toLowerCase().includes(q),
        ),
    [branches, q],
  );

  const filteredRoutes = useMemo(
    () =>
      !q
        ? routes
        : routes.filter((r) =>
          `${r.originBranch?.name} ${r.destinationBranch?.name} ${r.originBranch?.code} ${r.destinationBranch?.code}`
            .toLowerCase()
            .includes(q),
        ),
    [routes, q],
  );

  const filteredCustomers = useMemo(
    () =>
      !q
        ? customers
        : customers.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            (c.ciNit ?? '').toLowerCase().includes(q) ||
            (c.phone ?? '').toLowerCase().includes(q),
        ),
    [customers, q],
  );

  if (me?.role !== 'ADMIN_CENTRAL') {
    return (
      <p className="border border-white/10 p-6 text-slate-400">
        ACCESO EXCLUSIVO · ADMINISTRACIÓN CENTRAL
      </p>
    );
  }

  async function act(action: () => Promise<unknown>, success: string) {
    setMessage('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      setDrawerOpen(false);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Operación rechazada.',
      );
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingShipment(null);
    setEditingUser(null);
    setEditingBranch(null);
    setEditingRoute(null);
    setEditingCustomer(null);
  }

  function openNewDrawer() {
    closeDrawer();
    setDrawerOpen(true);
  }

  const tabs: Array<{
    id: Tab;
    label: string;
    count: number;
    Icon: typeof Package;
  }> = [
      {
        id: 'encomiendas',
        label: 'ENCOMIENDAS',
        count: shipments.length,
        Icon: Package,
      },
      { id: 'usuarios', label: 'PERSONAL', count: users.length, Icon: Users },
      {
        id: 'sucursales',
        label: 'SUCURSALES',
        count: branches.length,
        Icon: Building2,
      },
      { id: 'rutas', label: 'RUTAS', count: routes.length, Icon: RouteIcon },
      {
        id: 'clientes',
        label: 'CLIENTES',
        count: customers.length,
        Icon: Briefcase,
      },
      {
        id: 'reportes',
        label: 'REPORTES',
        count: shipments.filter(
          (s) =>
            new Date(new Date(s.createdAt ?? 0).getTime() - 14_400_000)
              .toISOString()
              .slice(0, 10) ===
            new Date(Date.now() - 14_400_000).toISOString().slice(0, 10),
        ).length,
        Icon: FileText,
      },
    ];

  return (
    <div className="animate-fade-up space-y-6">
      {/* Telemetría Global con Iconos Hexagonales y Barra de Flujo en Tiempo Real */}
      {overview && (
        <section className="no-print space-y-4">
          <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 lg:grid-cols-6">
            {[
              [Package, 'GUÍAS EN RED', String(overview.totalShipments)],
              [Wallet, 'FACTURADO', `BS ${overview.totalBilled.toFixed(0)}`],
              [
                CheckCircle2,
                'COBRO ORIGEN',
                `BS ${overview.collectedOrigin.toFixed(0)}`,
              ],
              [
                Truck,
                'COBRO DESTINO',
                `BS ${overview.collectedDestination.toFixed(0)}`,
              ],
              [
                RouteIcon,
                'OFICINAS / RUTAS',
                `${overview.activeBranches} / ${overview.activeRoutes}`,
              ],
              [
                Users,
                'EQUIPO / CLIENTES',
                `${overview.activeUsers} / ${overview.totalCustomers}`,
              ],
            ].map(([Icon, label, val], idx) => {
              const Comp = Icon as typeof Package;
              return (
                <div
                  key={String(label)}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className="animate-fade-up flex items-center justify-between bg-[#0d0f14] p-5"
                >
                  <div>
                    <p className="eyebrow">{String(label)}</p>
                    <p className="display-heading mt-1 text-3xl">{String(val)}</p>
                  </div>
                  <span className="hex-badge">
                    <Comp className="h-4 w-4" />
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 border border-white/10 bg-[#0d0f14] p-4 sm:grid-cols-4">
            {(
              [
                ['REGISTRADO', '1. EN ORIGEN'],
                ['EN_TRANSITO', '2. EN RUTA'],
                ['EN_SUCURSAL_DESTINO', '3. EN DESTINO'],
                ['ENTREGADO', '4. ENTREGADAS'],
              ] as const
            ).map(([st, label]) => {
              const count = overview.statusCounts[st] ?? 0;
              const pct =
                overview.totalShipments > 0
                  ? Math.round((count / overview.totalShipments) * 100)
                  : 0;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setTab('encomiendas');
                    setStatusFilter(statusFilter === st ? '' : st);
                  }}
                  className="text-left"
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-[#0077ff]">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-white/10">
                    <div
                      className="h-full bg-[#0077ff] transition-all duration-500"
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Barra de pestañas con iconos + Buscador + Botón Slidebar Drawer */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex flex-wrap gap-2" role="tablist">
          {tabs.map(({ id, label, count, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setSearch('');
                closeDrawer();
              }}
              className={`btn-tactile flex items-center gap-2 border px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider ${tab === id
                ? 'border-[#0077ff] bg-[#0077ff] text-white'
                : 'border-white/15 bg-[#0d0f14] text-slate-300 hover:border-[#0077ff]'
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
              <span
                className={`px-1.5 py-0.5 text-[10px] ${tab === id ? 'bg-white/20 text-white' : 'bg-white/10'
                  }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab !== 'reportes' && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="FILTRAR..."
                className="ns-input w-52 pl-9 py-2 text-xs"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => void load()}
            className={iconBtn}
            title="Sincronizar con PostgreSQL"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {tab === 'reportes' ? null : tab === 'encomiendas' ? (
            <a href="/sucursal/registrar" className="ns-btn-primary py-2 px-4">
              <Plus className="h-4 w-4" />
              <span>EMITIR GUÍA</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={openNewDrawer}
              className="ns-btn-primary py-2 px-4"
            >
              <Plus className="h-4 w-4" />
              <span>NUEVO</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="animate-fade-in border border-red-500/30 bg-red-950/30 p-3 text-xs font-bold uppercase text-red-300">
          {message}
        </p>
      )}
      {notice && (
        <p className="animate-fade-in border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs font-bold uppercase text-emerald-300">
          {notice}
        </p>
      )}

      {/* TAB 1: CONTROL GLOBAL DE ENCOMIENDAS */}
      {tab === 'encomiendas' && (
        <section className="animate-fade-in border border-white/10 bg-[#0d0f14] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className={`btn-tactile border px-3 py-1.5 text-xs font-bold uppercase ${statusFilter === ''
                  ? 'border-[#FFB800] bg-[#FFB800] text-black'
                  : 'border-white/15 text-slate-400'
                  }`}
              >
                TODOS
              </button>
              {(Object.keys(statusLabels) as ShipmentStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`btn-tactile border px-3 py-1.5 text-xs font-bold uppercase ${statusFilter === st
                    ? 'border-[#FFB800] bg-[#FFB800] text-black'
                    : 'border-white/15 text-slate-400'
                    }`}
                >
                  {statusLabels[st]}
                </button>
              ))}
            </div>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="ns-input w-48 py-1.5 text-xs"
            >
              <option value="">TODAS LAS SUCURSALES</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-white/10 text-sm">
            {filteredShipments.map((s) => (
              <div
                key={s.id}
                className="grid items-center gap-3 py-3.5 xl:grid-cols-[110px_1.2fr_1fr_130px_150px_auto]"
              >
                <div>
                  <span className="display-heading text-2xl text-[#FFB800]">
                    #{s.guideNumber}
                  </span>
                  <span className="block text-[11px] font-bold text-slate-400">
                    {s.originBranch?.code} → {s.destinationBranch?.code}
                  </span>
                </div>

                <div>
                  <p className="font-bold uppercase">{s.consignee.fullName}</p>
                  <p className="text-xs text-slate-500">
                    DE: {s.sender.fullName} · CI: {s.consignee.ciNit ?? 'S/N'}
                  </p>
                </div>

                <p className="truncate text-xs text-slate-400">
                  {s.items.map((i) => `${i.quantity}× ${i.description}`).join(', ')}
                </p>

                <div>
                  <strong className="display-heading text-2xl">
                    BS {Number(s.totalAmount).toFixed(0)}
                  </strong>
                  <span
                    className={`block text-[10px] font-extrabold uppercase ${s.isPaid ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                  >
                    {paymentLabels[s.paymentType]} ·{' '}
                    {s.isPaid ? 'PAGADO' : 'PENDIENTE'}
                  </span>
                </div>

                <select
                  value={s.status}
                  onChange={(e) =>
                    void act(
                      () =>
                        updateAdminShipment(s.id, {
                          status: e.target.value as ShipmentStatus,
                        }),
                      `GUÍA #${s.guideNumber} → ${e.target.value}`,
                    )
                  }
                  className="ns-input py-1.5 text-xs font-extrabold uppercase"
                >
                  {(Object.keys(statusLabels) as ShipmentStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {statusLabels[st]}
                    </option>
                  ))}
                </select>

                <div className="flex gap-1.5">
                  <button
                    className={iconBtn}
                    onClick={() => {
                      setEditingShipment({
                        id: s.id,
                        guideNumber: s.guideNumber,
                        originBranchId: s.originBranchId,
                        destinationBranchId: s.destinationBranchId,
                        status: s.status,
                        paymentType: s.paymentType,
                        isPaid: s.isPaid,
                        totalAmount: String(s.totalAmount),
                        receiverCiVerified: s.receiverCiVerified ?? '',
                        deliveryNotes: s.deliveryNotes ?? '',
                        remarks: '',
                      });
                      setDrawerOpen(true);
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>EDITAR</span>
                  </button>
                  <button
                    className={dangerBtn}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar guía #${s.guideNumber}?`)) {
                        void act(
                          () => deleteAdminShipment(s.id),
                          `GUÍA #${s.guideNumber} ELIMINADA.`,
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 2: USUARIOS Y PERMISOS */}
      {tab === 'usuarios' && (
        <section className="animate-fade-in border border-white/10 bg-[#0d0f14] p-5">
          <div className="divide-y divide-white/10 text-sm">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="grid items-center gap-3 py-3.5 xl:grid-cols-[1.3fr_110px_1fr_1fr_auto]"
              >
                <div>
                  <p className="font-bold uppercase">{user.fullName}</p>
                  <p className="text-xs text-slate-500">C.I. {user.ci}</p>
                </div>

                <span
                  className={`w-fit border px-2 py-0.5 text-[10px] font-extrabold uppercase ${user.isActive
                    ? 'border-emerald-500/40 text-emerald-300'
                    : 'border-red-500/40 text-red-300'
                    }`}
                >
                  {user.isActive ? 'ACTIVO' : 'BLOQUEADO'}
                </span>

                <select
                  value={user.branchId}
                  onChange={(e) =>
                    void act(
                      () => updateUser(user.id, { branchId: e.target.value }),
                      'SUCURSAL ACTUALIZADA.',
                    )
                  }
                  className="ns-input py-1.5 text-xs"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </select>

                <select
                  value={user.role}
                  onChange={(e) =>
                    void act(
                      () =>
                        updateUser(user.id, {
                          role: e.target.value as AdminUser['role'],
                        }),
                      'ROL ACTUALIZADO.',
                    )
                  }
                  className="ns-input py-1.5 text-xs font-bold uppercase"
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <div className="flex gap-1.5">
                  <button
                    className={iconBtn}
                    onClick={() => {
                      setEditingUser(user);
                      setDrawerOpen(true);
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className={iconBtn}
                    title="Cambiar contraseña"
                    onClick={() => {
                      const password = window.prompt(
                        `Nueva contraseña para ${user.fullName} (8+ caracteres):`,
                      );
                      if (password) {
                        void act(
                          () => updateUser(user.id, { password }),
                          'CLAVE ACTUALIZADA.',
                        );
                      }
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className={iconBtn}
                    title={user.isActive ? 'Bloquear acceso' : 'Habilitar acceso'}
                    onClick={() =>
                      void act(
                        () => updateUser(user.id, { isActive: !user.isActive }),
                        user.isActive ? 'ACCESO BLOQUEADO.' : 'ACCESO HABILITADO.',
                      )
                    }
                  >
                    {user.isActive ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {me?.id !== user.id && (
                    <button
                      className={dangerBtn}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar a ${user.fullName}?`)) {
                          void act(() => deleteUser(user.id), 'USUARIO ELIMINADO.');
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: SUCURSALES */}
      {tab === 'sucursales' && (
        <section className="animate-fade-in grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className="card-interactive flex flex-col justify-between border border-white/10 bg-[#0d0f14] p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="border border-[#FFB800] bg-[#FFB800]/10 px-2.5 py-0.5 text-xs font-extrabold text-[#FFB800]">
                    {branch.code}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase ${branch.isActive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                  >
                    {branch.isActive ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </div>
                <h3 className="display-heading mt-3 text-3xl">{branch.name}</h3>
                <p className="text-xs font-bold uppercase text-[#FFB800]">
                  {branch.department}
                </p>
                <p className="mt-2 text-xs text-slate-400">{branch.address}</p>
                {branch.phones && (
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    TEL. {branch.phones}
                  </p>
                )}
              </div>

              <div className="mt-5 flex gap-2 border-t border-white/10 pt-3">
                <button
                  className={iconBtn}
                  onClick={() => {
                    setEditingBranch(branch);
                    setDrawerOpen(true);
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>EDITAR</span>
                </button>
                <button
                  className={iconBtn}
                  onClick={() =>
                    void act(
                      () =>
                        updateBranch(branch.id, { isActive: !branch.isActive }),
                      'ESTADO ACTUALIZADO.',
                    )
                  }
                >
                  {branch.isActive ? 'DESACTIVAR' : 'ACTIVAR'}
                </button>
                <button
                  className={dangerBtn}
                  onClick={() => {
                    if (window.confirm(`¿Eliminar ${branch.name}?`)) {
                      void act(() => deleteBranch(branch.id), 'SUCURSAL PROCESADA.');
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* TAB 4: RUTAS Y TARIFAS */}
      {tab === 'rutas' && (
        <section className="animate-fade-in grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRoutes.map((route) => (
            <div
              key={route.id}
              className="card-interactive flex flex-col justify-between border border-white/10 bg-[#0d0f14] p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="border border-[#FFB800]/40 bg-[#FFB800]/10 px-2.5 py-0.5 text-xs font-extrabold text-[#FFB800]">
                    {route.originBranch?.code} → {route.destinationBranch?.code}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {route.estimatedHours ? `~${route.estimatedHours}H` : '24H'}
                  </span>
                </div>

                <h3 className="display-heading mt-3 text-3xl">
                  {route.originBranch?.name} → {route.destinationBranch?.name}
                </h3>

                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">
                      TARIFA BASE
                    </span>
                    <strong className="display-heading text-3xl text-[#FFB800]">
                      BS {Number(route.basePrice).toFixed(0)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase text-slate-500">
                      POR KG
                    </span>
                    <strong className="text-sm font-bold">
                      +BS {Number(route.pricePerKg).toFixed(1)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2 border-t border-white/10 pt-3">
                <button
                  className={iconBtn}
                  onClick={() => {
                    setEditingRoute(route);
                    setDrawerOpen(true);
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>EDITAR</span>
                </button>
                <button
                  className={iconBtn}
                  onClick={() =>
                    void act(
                      () =>
                        updateRoute(route.id, { isActive: !route.isActive }),
                      'RUTA ACTUALIZADA.',
                    )
                  }
                >
                  {route.isActive ? 'DESACTIVAR' : 'ACTIVAR'}
                </button>
                <button
                  className={dangerBtn}
                  onClick={() => {
                    if (window.confirm('¿Eliminar ruta?')) {
                      void act(() => deleteRoute(route.id), 'RUTA ELIMINADA.');
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* TAB 5: CLIENTES */}
      {tab === 'clientes' && (
        <section className="animate-fade-in border border-white/10 bg-[#0d0f14] p-5">
          <div className="divide-y divide-white/10 text-sm">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="grid items-center gap-3 py-3.5 md:grid-cols-[1.4fr_1fr_1fr_auto]"
              >
                <div>
                  <p className="font-bold uppercase">{customer.fullName}</p>
                  <p className="text-xs text-slate-500">
                    CI/NIT: {customer.ciNit ?? 'S/N'} · TEL:{' '}
                    {customer.phone ?? 'S/N'}
                  </p>
                </div>

                <span
                  className={`w-fit border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${customer.isCorporateAccount
                    ? 'border-[#FFB800] text-[#FFB800]'
                    : 'border-white/15 text-slate-400'
                    }`}
                >
                  {customer.isCorporateAccount
                    ? `CORPORATIVO · BS ${Number(customer.corporateCreditLimit).toFixed(0)}`
                    : 'PARTICULAR'}
                </span>

                <span className="text-xs text-slate-500">
                  ID {customer.id.slice(0, 8)}
                </span>

                <div className="flex gap-1.5">
                  <button
                    className={iconBtn}
                    onClick={() => {
                      setEditingCustomer(customer);
                      setDrawerOpen(true);
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>EDITAR</span>
                  </button>
                  <button
                    className={dangerBtn}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar ${customer.fullName}?`)) {
                        void act(
                          () => deleteCustomer(customer.id),
                          'CLIENTE ELIMINADO.',
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'reportes' && <ReportsPanel branches={branches} />}

      {/* SLIDEBAR DRAWER LATERAL PARA CREAR / EDITAR SIN SATURAR LA PÁGINA */}
      {drawerOpen && (
        <>
          <div className="ns-drawer-backdrop" onClick={closeDrawer} />
          <aside className="ns-drawer-panel">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="eyebrow">PANEL DESLIZANTE · POSTGRESQL</span>
                <h3 className="display-heading mt-1 text-3xl">
                  {editingShipment
                    ? `GUÍA #${editingShipment.guideNumber}`
                    : tab === 'usuarios'
                      ? editingUser
                        ? 'EDITAR USUARIO'
                        : 'NUEVO USUARIO'
                      : tab === 'sucursales'
                        ? editingBranch
                          ? 'EDITAR SUCURSAL'
                          : 'NUEVA SUCURSAL'
                        : tab === 'rutas'
                          ? editingRoute
                            ? 'EDITAR RUTA'
                            : 'NUEVA RUTA'
                          : editingCustomer
                            ? 'EDITAR CLIENTE'
                            : 'NUEVO CLIENTE'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="hex-btn"
                aria-label="Cerrar panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* FORMULARIO SLIDE-OVER: ENCOMIENDA */}
            {editingShipment && (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    await updateAdminShipment(editingShipment.id, {
                      originBranchId: editingShipment.originBranchId,
                      destinationBranchId: editingShipment.destinationBranchId,
                      status: editingShipment.status,
                      paymentType: editingShipment.paymentType,
                      isPaid: editingShipment.isPaid,
                      totalAmount: Number(editingShipment.totalAmount),
                      receiverCiVerified: editingShipment.receiverCiVerified,
                      deliveryNotes: editingShipment.deliveryNotes,
                      remarks: editingShipment.remarks || undefined,
                    });
                  }, `GUÍA #${editingShipment.guideNumber} ACTUALIZADA.`);
                }}
              >
                <label className="block text-xs font-bold uppercase text-slate-400">
                  ESTADO
                  <select
                    value={editingShipment.status}
                    onChange={(e) =>
                      setEditingShipment({
                        ...editingShipment,
                        status: e.target.value as ShipmentStatus,
                      })
                    }
                    className={`${input} mt-1`}
                  >
                    {(Object.keys(statusLabels) as ShipmentStatus[]).map(
                      (st) => (
                        <option key={st} value={st}>
                          {statusLabels[st]}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold uppercase text-slate-400">
                    ORIGEN
                    <select
                      value={editingShipment.originBranchId}
                      onChange={(e) =>
                        setEditingShipment({
                          ...editingShipment,
                          originBranchId: e.target.value,
                        })
                      }
                      className={`${input} mt-1`}
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} · {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase text-slate-400">
                    DESTINO
                    <select
                      value={editingShipment.destinationBranchId}
                      onChange={(e) =>
                        setEditingShipment({
                          ...editingShipment,
                          destinationBranchId: e.target.value,
                        })
                      }
                      className={`${input} mt-1`}
                    >
                      {branches
                        .filter((b) => b.id !== editingShipment.originBranchId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} · {b.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold uppercase text-slate-400">
                    MODALIDAD
                    <select
                      value={editingShipment.paymentType}
                      onChange={(e) =>
                        setEditingShipment({
                          ...editingShipment,
                          paymentType: e.target.value as PaymentType,
                        })
                      }
                      className={`${input} mt-1`}
                    >
                      {(Object.keys(paymentLabels) as PaymentType[]).map(
                        (pt) => (
                          <option key={pt} value={pt}>
                            {paymentLabels[pt]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase text-slate-400">
                    MONTO (BS)
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editingShipment.totalAmount}
                      onChange={(e) =>
                        setEditingShipment({
                          ...editingShipment,
                          totalAmount: e.target.value,
                        })
                      }
                      className={`${input} mt-1`}
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold uppercase">
                  <input
                    type="checkbox"
                    checked={editingShipment.isPaid}
                    onChange={(e) =>
                      setEditingShipment({
                        ...editingShipment,
                        isPaid: e.target.checked,
                      })
                    }
                  />
                  GUÍA COBRADA / PAGADA
                </label>

                <input
                  className={input}
                  placeholder="C.I. RECEPTOR VERIFICADO"
                  value={editingShipment.receiverCiVerified}
                  onChange={(e) =>
                    setEditingShipment({
                      ...editingShipment,
                      receiverCiVerified: e.target.value,
                    })
                  }
                />

                <input
                  className={input}
                  placeholder="NOTAS DE ENTREGA / AUDITORÍA"
                  value={editingShipment.remarks}
                  onChange={(e) =>
                    setEditingShipment({
                      ...editingShipment,
                      remarks: e.target.value,
                    })
                  }
                />

                <button type="submit" className="ns-btn-primary w-full py-3.5">
                  GUARDAR CAMBIOS →
                </button>
              </form>
            )}

            {/* FORMULARIO SLIDE-OVER: USUARIOS */}
            {!editingShipment && tab === 'usuarios' && (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingUser) {
                    void act(async () => {
                      await updateUser(editingUser.id, {
                        fullName: editingUser.fullName,
                        ci: editingUser.ci,
                        branchId: editingUser.branchId,
                        role: editingUser.role,
                      });
                    }, 'USUARIO ACTUALIZADO.');
                  } else {
                    void act(async () => {
                      await createUser(userForm);
                      setUserForm({
                        branchId: '',
                        fullName: '',
                        ci: '',
                        role: 'OPERADOR',
                        password: '',
                      });
                    }, 'USUARIO CREADO.');
                  }
                }}
              >
                <input
                  required
                  className={input}
                  placeholder="NOMBRE COMPLETO"
                  value={editingUser ? editingUser.fullName : userForm.fullName}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({
                        ...editingUser,
                        fullName: e.target.value,
                      })
                      : setUserForm({ ...userForm, fullName: e.target.value })
                  }
                />
                <input
                  required
                  className={input}
                  placeholder="C.I."
                  value={editingUser ? editingUser.ci : userForm.ci}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({ ...editingUser, ci: e.target.value })
                      : setUserForm({ ...userForm, ci: e.target.value })
                  }
                />
                <select
                  required
                  className={input}
                  value={editingUser ? editingUser.branchId : userForm.branchId}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({
                        ...editingUser,
                        branchId: e.target.value,
                      })
                      : setUserForm({ ...userForm, branchId: e.target.value })
                  }
                >
                  <option value="">SELECCIONA SUCURSAL</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </select>
                <select
                  className={input}
                  value={editingUser ? editingUser.role : userForm.role}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({
                        ...editingUser,
                        role: e.target.value as AdminUser['role'],
                      })
                      : setUserForm({
                        ...userForm,
                        role: e.target.value as AdminUser['role'],
                      })
                  }
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {!editingUser && (
                  <input
                    required
                    minLength={8}
                    type="password"
                    className={input}
                    placeholder="CONTRASEÑA (MÍN. 8)"
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({ ...userForm, password: e.target.value })
                    }
                  />
                )}
                <button type="submit" className="ns-btn-primary w-full py-3.5">
                  GUARDAR USUARIO →
                </button>
              </form>
            )}

            {/* FORMULARIO SLIDE-OVER: SUCURSALES */}
            {!editingShipment && tab === 'sucursales' && (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingBranch) {
                    void act(async () => {
                      await updateBranch(editingBranch.id, {
                        code: editingBranch.code,
                        name: editingBranch.name,
                        department: editingBranch.department,
                        address: editingBranch.address,
                        phones: editingBranch.phones ?? undefined,
                        isOwnOffice: editingBranch.isOwnOffice,
                      });
                    }, 'SUCURSAL ACTUALIZADA.');
                  } else {
                    void act(async () => {
                      await createBranch({
                        ...branchForm,
                        phones: branchForm.phones || undefined,
                      });
                      setBranchForm({
                        code: '',
                        name: '',
                        department: '',
                        address: '',
                        phones: '',
                        isOwnOffice: true,
                      });
                    }, 'SUCURSAL CREADA.');
                  }
                }}
              >
                <input
                  required
                  className={input}
                  placeholder="CÓDIGO (EJ. TJA)"
                  value={editingBranch ? editingBranch.code : branchForm.code}
                  onChange={(e) =>
                    editingBranch
                      ? setEditingBranch({
                        ...editingBranch,
                        code: e.target.value.toUpperCase(),
                      })
                      : setBranchForm({
                        ...branchForm,
                        code: e.target.value.toUpperCase(),
                      })
                  }
                />
                <input
                  required
                  className={input}
                  placeholder="NOMBRE DE OFICINA"
                  value={editingBranch ? editingBranch.name : branchForm.name}
                  onChange={(e) =>
                    editingBranch
                      ? setEditingBranch({
                        ...editingBranch,
                        name: e.target.value,
                      })
                      : setBranchForm({ ...branchForm, name: e.target.value })
                  }
                />
                <input
                  required
                  className={input}
                  placeholder="DEPARTAMENTO"
                  value={
                    editingBranch
                      ? editingBranch.department
                      : branchForm.department
                  }
                  onChange={(e) =>
                    editingBranch
                      ? setEditingBranch({
                        ...editingBranch,
                        department: e.target.value,
                      })
                      : setBranchForm({
                        ...branchForm,
                        department: e.target.value,
                      })
                  }
                />
                <input
                  required
                  className={input}
                  placeholder="DIRECCIÓN"
                  value={
                    editingBranch ? editingBranch.address : branchForm.address
                  }
                  onChange={(e) =>
                    editingBranch
                      ? setEditingBranch({
                        ...editingBranch,
                        address: e.target.value,
                      })
                      : setBranchForm({
                        ...branchForm,
                        address: e.target.value,
                      })
                  }
                />
                <input
                  className={input}
                  placeholder="TELÉFONOS"
                  value={
                    editingBranch
                      ? (editingBranch.phones ?? '')
                      : branchForm.phones
                  }
                  onChange={(e) =>
                    editingBranch
                      ? setEditingBranch({
                        ...editingBranch,
                        phones: e.target.value,
                      })
                      : setBranchForm({ ...branchForm, phones: e.target.value })
                  }
                />
                <button type="submit" className="ns-btn-primary w-full py-3.5">
                  GUARDAR SUCURSAL →
                </button>
              </form>
            )}

            {/* FORMULARIO SLIDE-OVER: RUTAS */}
            {!editingShipment && tab === 'rutas' && (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingRoute) {
                    void act(async () => {
                      await updateRoute(editingRoute.id, {
                        originBranchId: editingRoute.originBranchId,
                        destinationBranchId: editingRoute.destinationBranchId,
                        basePrice: Number(editingRoute.basePrice),
                        pricePerKg: Number(editingRoute.pricePerKg),
                        estimatedHours: editingRoute.estimatedHours
                          ? Number(editingRoute.estimatedHours)
                          : null,
                      });
                    }, 'RUTA ACTUALIZADA.');
                  } else {
                    void act(async () => {
                      await createRoute({
                        originBranchId: routeForm.originBranchId,
                        destinationBranchId: routeForm.destinationBranchId,
                        basePrice: Number(routeForm.basePrice),
                        pricePerKg: Number(routeForm.pricePerKg || 0),
                        estimatedHours: routeForm.estimatedHours
                          ? Number(routeForm.estimatedHours)
                          : undefined,
                      });
                      setRouteForm({
                        originBranchId: '',
                        destinationBranchId: '',
                        basePrice: '',
                        pricePerKg: '0',
                        estimatedHours: '',
                      });
                    }, 'RUTA CREADA.');
                  }
                }}
              >
                <select
                  required
                  className={input}
                  value={
                    editingRoute
                      ? editingRoute.originBranchId
                      : routeForm.originBranchId
                  }
                  onChange={(e) =>
                    editingRoute
                      ? setEditingRoute({
                        ...editingRoute,
                        originBranchId: e.target.value,
                      })
                      : setRouteForm({
                        ...routeForm,
                        originBranchId: e.target.value,
                      })
                  }
                >
                  <option value="">SUCURSAL ORIGEN</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  className={input}
                  value={
                    editingRoute
                      ? editingRoute.destinationBranchId
                      : routeForm.destinationBranchId
                  }
                  onChange={(e) =>
                    editingRoute
                      ? setEditingRoute({
                        ...editingRoute,
                        destinationBranchId: e.target.value,
                      })
                      : setRouteForm({
                        ...routeForm,
                        destinationBranchId: e.target.value,
                      })
                  }
                >
                  <option value="">SUCURSAL DESTINO</option>
                  {branches
                    .filter(
                      (b) =>
                        b.id !==
                        (editingRoute
                          ? editingRoute.originBranchId
                          : routeForm.originBranchId),
                    )
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} · {b.name}
                      </option>
                    ))}
                </select>
                <input
                  required
                  type="number"
                  step="0.01"
                  className={input}
                  placeholder="TARIFA BASE (BS)"
                  value={
                    editingRoute
                      ? String(editingRoute.basePrice)
                      : routeForm.basePrice
                  }
                  onChange={(e) =>
                    editingRoute
                      ? setEditingRoute({
                        ...editingRoute,
                        basePrice: e.target.value,
                      })
                      : setRouteForm({
                        ...routeForm,
                        basePrice: e.target.value,
                      })
                  }
                />
                <input
                  type="number"
                  step="0.01"
                  className={input}
                  placeholder="BS POR KG ADICIONAL"
                  value={
                    editingRoute
                      ? String(editingRoute.pricePerKg)
                      : routeForm.pricePerKg
                  }
                  onChange={(e) =>
                    editingRoute
                      ? setEditingRoute({
                        ...editingRoute,
                        pricePerKg: e.target.value,
                      })
                      : setRouteForm({
                        ...routeForm,
                        pricePerKg: e.target.value,
                      })
                  }
                />
                <input
                  type="number"
                  className={input}
                  placeholder="HORAS ESTIMADAS (EJ. 8)"
                  value={
                    editingRoute
                      ? String(editingRoute.estimatedHours ?? '')
                      : routeForm.estimatedHours
                  }
                  onChange={(e) =>
                    editingRoute
                      ? setEditingRoute({
                        ...editingRoute,
                        estimatedHours: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                      : setRouteForm({
                        ...routeForm,
                        estimatedHours: e.target.value,
                      })
                  }
                />
                <button type="submit" className="ns-btn-primary w-full py-3.5">
                  GUARDAR RUTA →
                </button>
              </form>
            )}

            {/* FORMULARIO SLIDE-OVER: CLIENTES */}
            {!editingShipment && tab === 'clientes' && (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingCustomer) {
                    void act(async () => {
                      await updateCustomer(editingCustomer.id, {
                        fullName: editingCustomer.fullName,
                        ciNit: editingCustomer.ciNit ?? undefined,
                        phone: editingCustomer.phone ?? undefined,
                        isCorporateAccount: editingCustomer.isCorporateAccount,
                        corporateCreditLimit: Number(
                          editingCustomer.corporateCreditLimit || 0,
                        ),
                      });
                    }, 'CLIENTE ACTUALIZADO.');
                  } else {
                    void act(async () => {
                      await createCustomer({
                        fullName: customerForm.fullName,
                        ciNit: customerForm.ciNit || undefined,
                        phone: customerForm.phone || undefined,
                        isCorporateAccount: customerForm.isCorporateAccount,
                        corporateCreditLimit: Number(
                          customerForm.corporateCreditLimit || 0,
                        ),
                      });
                      setCustomerForm({
                        fullName: '',
                        ciNit: '',
                        phone: '',
                        isCorporateAccount: false,
                        corporateCreditLimit: '0',
                      });
                    }, 'CLIENTE CREADO.');
                  }
                }}
              >
                <input
                  required
                  className={input}
                  placeholder="NOMBRE O RAZÓN SOCIAL"
                  value={
                    editingCustomer
                      ? editingCustomer.fullName
                      : customerForm.fullName
                  }
                  onChange={(e) =>
                    editingCustomer
                      ? setEditingCustomer({
                        ...editingCustomer,
                        fullName: e.target.value,
                      })
                      : setCustomerForm({
                        ...customerForm,
                        fullName: e.target.value,
                      })
                  }
                />
                <input
                  className={input}
                  placeholder="C.I. / NIT"
                  value={
                    editingCustomer
                      ? (editingCustomer.ciNit ?? '')
                      : customerForm.ciNit
                  }
                  onChange={(e) =>
                    editingCustomer
                      ? setEditingCustomer({
                        ...editingCustomer,
                        ciNit: e.target.value,
                      })
                      : setCustomerForm({
                        ...customerForm,
                        ciNit: e.target.value,
                      })
                  }
                />
                <input
                  className={input}
                  placeholder="TELÉFONO"
                  value={
                    editingCustomer
                      ? (editingCustomer.phone ?? '')
                      : customerForm.phone
                  }
                  onChange={(e) =>
                    editingCustomer
                      ? setEditingCustomer({
                        ...editingCustomer,
                        phone: e.target.value,
                      })
                      : setCustomerForm({
                        ...customerForm,
                        phone: e.target.value,
                      })
                  }
                />
                <label className="flex items-center gap-2 text-xs font-bold uppercase">
                  <input
                    type="checkbox"
                    checked={
                      editingCustomer
                        ? editingCustomer.isCorporateAccount
                        : customerForm.isCorporateAccount
                    }
                    onChange={(e) =>
                      editingCustomer
                        ? setEditingCustomer({
                          ...editingCustomer,
                          isCorporateAccount: e.target.checked,
                        })
                        : setCustomerForm({
                          ...customerForm,
                          isCorporateAccount: e.target.checked,
                        })
                    }
                  />
                  CUENTA CORPORATIVA CON CRÉDITO
                </label>
                <input
                  type="number"
                  step="0.01"
                  className={input}
                  placeholder="LÍMITE DE CRÉDITO (BS)"
                  value={
                    editingCustomer
                      ? String(editingCustomer.corporateCreditLimit)
                      : customerForm.corporateCreditLimit
                  }
                  onChange={(e) =>
                    editingCustomer
                      ? setEditingCustomer({
                        ...editingCustomer,
                        corporateCreditLimit: e.target.value,
                      })
                      : setCustomerForm({
                        ...customerForm,
                        corporateCreditLimit: e.target.value,
                      })
                  }
                />
                <button type="submit" className="ns-btn-primary w-full py-3.5">
                  GUARDAR CLIENTE →
                </button>
              </form>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
