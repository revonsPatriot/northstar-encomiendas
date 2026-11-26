import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  LogOut,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type {
  AccountActivity,
  AccountProfile,
  ShipmentStatus,
} from '../../../../shared/types/shipment.types';
import {
  changePassword,
  getAccountActivity,
  getAccountProfile,
} from '../../services/account.service';
import { clearSession } from '../../services/api-client';
import AnimatedNumber from '../ui/AnimatedNumber';

const roleLabels: Record<AccountProfile['role'], string> = {
  ADMIN_CENTRAL: 'Administrador Central',
  ENCARGADO_SUCURSAL: 'Encargado de Sucursal',
  OPERADOR: 'Operador de Ventanilla',
};

const rolePermissions: Record<AccountProfile['role'], string[]> = {
  ADMIN_CENTRAL: [
    'Control global de todas las encomiendas y estados',
    'Reportes diarios, semanales y mensuales con exportación CSV/PDF',
    'CRUD completo de personal, roles, sucursales, rutas y clientes',
    'Cambio de sucursal activa desde la cabecera operativa',
  ],
  ENCARGADO_SUCURSAL: [
    'Emisión de guías con tarifa automática y ticket QR',
    'Despacho, confirmación de arribo y entrega verificada con C.I.',
    'Anulación autorizada de guías en origen o tránsito',
    'Arqueo y cierre diario de caja de la sucursal',
  ],
  OPERADOR: [
    'Emisión de guías en ventanilla con soporte sin conexión',
    'Despacho desde origen y recepción en sucursal destino',
    'Confirmación de entrega con verificación de C.I. y cobro en destino',
    'Registro de arqueo diario de caja',
  ],
};

const statusLabels: Record<ShipmentStatus, string> = {
  REGISTRADO: 'En origen',
  EN_TRANSITO: 'En ruta',
  EN_SUCURSAL_DESTINO: 'En destino',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
};

const bs = (value: number) =>
  `Bs ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AccountIsland() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [activity, setActivity] = useState<AccountActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isWelcome, setIsWelcome] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [me, act] = await Promise.all([
        getAccountProfile(),
        getAccountActivity(),
      ]);
      setProfile(me);
      setActivity(act);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo cargar tu cuenta.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('bienvenida') === '1') {
      setIsWelcome(true);
    }
    void load();
  }, [load]);

  async function handlePasswordSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: 'err',
        text: 'Las contraseñas nuevas no coinciden.',
      });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({
        type: 'ok',
        text: 'Contraseña actualizada correctamente.',
      });
    } catch (requestError) {
      setPasswordMessage({
        type: 'err',
        text:
          requestError instanceof Error
            ? requestError.message
            : 'No se pudo actualizar la contraseña.',
      });
    } finally {
      setSavingPassword(false);
    }
  }

  const initials = (profile?.fullName ?? 'NS')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const quickActions = [
    { href: '/sucursal/registrar', label: 'Emitir guía', icon: Package },
    { href: '/sucursal/despacho', label: 'Despacho y arribo', icon: Truck },
    { href: '/sucursal/recepcion', label: 'Entregar en destino', icon: CheckCircle2 },
    { href: '/sucursal/arqueo', label: 'Arqueo de caja', icon: Wallet },
    ...(profile?.role === 'ADMIN_CENTRAL'
      ? [{ href: '/sucursal/admin', label: 'Control central y reportes', icon: ShieldCheck }]
      : []),
  ];

  return (
    <div className="animate-fade-up space-y-6">
      {isWelcome && (
        <div className="animate-fade-in flex flex-wrap items-center justify-between gap-4 border border-[#8b5cf6]/50 bg-gradient-to-r from-[#0077ff]/15 via-transparent to-[#8b5cf6]/20 p-5">
          <div className="flex items-center gap-3">
            <span className="hex-badge hex-badge-violet">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">Registro completado</p>
              <p className="text-base font-bold">
                ¡Bienvenido{profile ? `, ${profile.fullName}` : ''}! Tu cuenta ya está activa y conectada a tu sucursal.
              </p>
            </div>
          </div>
          <a href="/sucursal/registrar" className="ns-btn-primary">
            <span>Emitir primera guía</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}

      {error && (
        <p role="alert" className="border border-red-500/30 bg-red-950/30 p-4 text-sm font-semibold text-red-300">
          {error}
        </p>
      )}

      {/* Cabecera de perfil */}
      <section className="grid gap-6 xl:grid-cols-12">
        <div className="border border-white/15 bg-[#0b101e] p-6 xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="brand-emblem h-14 w-14 text-xl">{initials}</div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip-violet px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider">
                    {profile ? roleLabels[profile.role] : 'Cargando…'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-emerald-400">
                    <span className="live-dot" /> Sesión activa
                  </span>
                </div>
                <h2 className="display-heading mt-2 text-3xl md:text-4xl">
                  {profile?.fullName ?? 'Cargando perfil…'}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-4 text-xs font-bold uppercase text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-[#0077ff]" />
                    C.I. {profile?.ci ?? '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#8b5cf6]" />
                    {profile ? `${profile.branch.code} · ${profile.branch.name}` : '—'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="ns-btn-outline px-3 py-2"
                title="Actualizar actividad"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  window.location.href = '/login';
                }}
                className="btn-tactile inline-flex items-center gap-2 border border-red-500/40 px-3.5 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Salir</span>
              </button>
            </div>
          </div>

          {/* Permisos del rol */}
          {profile && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="eyebrow">Permisos habilitados para tu cuenta</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {rolePermissions[profile.role].map((permission) => (
                  <li
                    key={permission}
                    className="flex items-start gap-2 border border-white/10 bg-[#050811] p-3 text-xs font-semibold text-slate-300"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0077ff]" />
                    <span>{permission}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Accesos directos de trabajo */}
        <div className="border border-white/15 bg-[#0b101e] p-6 xl:col-span-5">
          <p className="eyebrow">Espacio de trabajo</p>
          <h3 className="display-heading mt-1 text-2xl">Acciones rápidas</h3>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {quickActions.map(({ href, label, icon: Icon }, idx) => (
              <a
                key={href}
                href={href}
                className={`card-interactive group flex items-center justify-between border border-white/10 bg-[#050811] p-4 ${
                  idx === quickActions.length - 1 && quickActions.length % 2 === 1
                    ? 'sm:col-span-2'
                    : ''
                }`}
              >
                <span className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-wider group-hover:text-[#0077ff]">
                  <Icon className="h-4 w-4 text-[#0077ff]" />
                  {label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-[#0077ff]" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Métricas personales */}
      <section className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 lg:grid-cols-4">
        {[
          {
            label: 'Emitidas hoy por mí',
            value: activity?.emittedToday ?? 0,
            decimals: 0,
            prefix: '',
            Icon: Package,
            badge: 'hex-badge',
          },
          {
            label: 'Total emitidas',
            value: activity?.emittedTotal ?? 0,
            decimals: 0,
            prefix: '',
            Icon: Truck,
            badge: 'hex-badge hex-badge-violet',
          },
          {
            label: 'Entregas confirmadas',
            value: activity?.deliveredTotal ?? 0,
            decimals: 0,
            prefix: '',
            Icon: CheckCircle2,
            badge: 'hex-badge',
          },
          {
            label: 'Recaudado hoy',
            value: activity?.collectedToday ?? 0,
            decimals: 2,
            prefix: 'Bs ',
            Icon: Wallet,
            badge: 'hex-badge hex-badge-violet',
          },
        ].map(({ label, value, decimals, prefix, Icon, badge }, idx) => (
          <div
            key={label}
            style={{ animationDelay: `${idx * 60}ms` }}
            className="animate-fade-up card-interactive flex items-center justify-between bg-[#0b101e] p-5"
          >
            <div>
              <p className="eyebrow">{label}</p>
              {activity ? (
                <AnimatedNumber
                  value={value}
                  decimals={decimals}
                  prefix={prefix}
                  className="display-heading mt-1 block text-3xl md:text-4xl"
                />
              ) : (
                <div className="skeleton mt-2 h-9 w-20" />
              )}
            </div>
            <span className={badge}>
              <Icon className="h-5 w-5" />
            </span>
          </div>
        ))}
      </section>

      {/* Actividad reciente + Cambio de contraseña */}
      <section className="grid gap-6 xl:grid-cols-12">
        <div className="border border-white/15 bg-[#0b101e] p-6 xl:col-span-7">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="eyebrow">Historial personal</p>
              <h3 className="display-heading mt-1 text-2xl">Últimas guías que emitiste</h3>
            </div>
            <a href="/sucursal/despacho" className="text-xs font-bold uppercase text-[#0077ff] hover:underline">
              Ver todas →
            </a>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3">Guía</th>
                  <th className="py-2.5 pr-3">Ruta</th>
                  <th className="py-2.5 pr-3">Consignatario</th>
                  <th className="py-2.5 pr-3">Estado</th>
                  <th className="py-2.5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {!activity || activity.recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center font-semibold text-slate-500">
                      Todavía no has emitido guías con esta cuenta.
                    </td>
                  </tr>
                ) : (
                  activity.recent.map((row) => (
                    <tr
                      key={row.guideNumber}
                      className="border-b border-white/5 transition-colors hover:bg-[#0077ff]/10"
                    >
                      <td className="py-3 pr-3 font-extrabold text-[#0077ff]">
                        <a href={`/?guia=${row.guideNumber}`} className="hover:underline">
                          #{row.guideNumber}
                        </a>
                      </td>
                      <td className="py-3 pr-3 font-bold">
                        {row.originCode} → {row.destinationCode}
                      </td>
                      <td className="py-3 pr-3">{row.consigneeName}</td>
                      <td className="py-3 pr-3 font-bold uppercase">
                        {statusLabels[row.status]}
                      </td>
                      <td className="py-3 text-right font-extrabold">
                        {bs(row.totalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seguridad: Cambiar contraseña */}
        <div className="border border-white/15 bg-[#0b101e] p-6 xl:col-span-5">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <span className="hex-badge hex-badge-violet">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <p className="eyebrow">Seguridad</p>
              <h3 className="display-heading text-2xl">Cambiar contraseña</h3>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Contraseña actual
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="ns-input mt-1.5"
              />
            </label>

            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Nueva contraseña (mín. 8 caracteres)
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="ns-input mt-1.5"
              />
            </label>

            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Confirmar nueva contraseña
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="ns-input mt-1.5"
              />
            </label>

            {passwordMessage && (
              <p
                role={passwordMessage.type === 'err' ? 'alert' : 'status'}
                className={`animate-fade-in border p-3 text-xs font-bold uppercase ${
                  passwordMessage.type === 'ok'
                    ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                    : 'border-red-500/40 bg-red-950/30 text-red-300'
                }`}
              >
                {passwordMessage.text}
              </p>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="ns-btn-primary w-full py-3.5"
            >
              {savingPassword ? 'Actualizando…' : 'Actualizar contraseña →'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
