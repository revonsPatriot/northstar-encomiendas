import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Package,
  Printer,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type {
  PaymentType,
  ReportPeriod,
  ShipmentReport,
  ShipmentStatus,
} from '../../../../shared/types/shipment.types';
import { getShipmentReport, type AdminBranch } from '../../services/admin.service';
import AnimatedNumber from '../ui/AnimatedNumber';

const BOLIVIA_OFFSET_MS = 4 * 60 * 60 * 1000;
const ON_SCREEN_ROWS = 100;

const periods: Array<{ id: ReportPeriod; label: string }> = [
  { id: 'day', label: 'Diario' },
  { id: 'week', label: 'Semanal' },
  { id: 'month', label: 'Mensual' },
];

const statusLabels: Record<ShipmentStatus, string> = {
  REGISTRADO: 'En origen',
  EN_TRANSITO: 'En ruta',
  EN_SUCURSAL_DESTINO: 'En destino',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
};

const statusColors: Record<ShipmentStatus, string> = {
  REGISTRADO: 'bg-[#38bdf8]',
  EN_TRANSITO: 'bg-[#0077ff]',
  EN_SUCURSAL_DESTINO: 'bg-[#8b5cf6]',
  ENTREGADO: 'bg-emerald-500',
  ANULADO: 'bg-red-500',
};

const paymentLabels: Record<PaymentType, string> = {
  PAGADO_ORIGEN: 'Pagado en origen',
  POR_PAGAR: 'Por pagar en destino',
  CUENTA_CORPORATIVA: 'Cuenta corporativa',
};

const todayBolivia = () =>
  new Date(Date.now() - BOLIVIA_OFFSET_MS).toISOString().slice(0, 10);

function shiftDate(ymd: string, period: ReportPeriod, direction: 1 | -1): string {
  const [year, month, day] = ymd.split('-').map(Number);
  if (period === 'month') {
    return new Date(Date.UTC(year, month - 1 + direction, 1)).toISOString().slice(0, 10);
  }
  const step = period === 'week' ? 7 : 1;
  return new Date(Date.UTC(year, month - 1, day + direction * step)).toISOString().slice(0, 10);
}

const bs = (value: number) => `Bs ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return current > 0 ? (
      <span className="chip-violet px-2 py-0.5 text-[10px] font-extrabold uppercase">Nuevo</span>
    ) : (
      <span className="text-[11px] font-semibold text-slate-500">Sin movimiento previo</span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {pct}% vs. periodo anterior
    </span>
  );
}

function exportCsv(report: ShipmentReport) {
  const header = [
    'Guía',
    'Fecha',
    'Origen',
    'Destino',
    'Remitente',
    'Consignatario',
    'Estado',
    'Modalidad',
    'Pagado',
    'Monto (Bs)',
    'Peso (kg)',
  ];
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const lines = [
    header.map(escape).join(','),
    ...report.rows.map((row) =>
      [
        row.guideNumber,
        new Date(row.createdAt).toLocaleString('es-BO'),
        row.origin,
        row.destination,
        row.sender,
        row.consignee,
        statusLabels[row.status],
        paymentLabels[row.paymentType],
        row.isPaid ? 'Sí' : 'No',
        row.totalAmount.toFixed(2),
        row.weightKg.toFixed(2),
      ]
        .map(escape)
        .join(','),
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `northstar-reporte-${report.period}-${report.from}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function printReport() {
  // El reporte se imprime siempre en tema claro para ahorrar tinta y mejorar la lectura.
  const previous = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', 'light');
  const restore = () => {
    if (previous) document.documentElement.setAttribute('data-theme', previous);
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

export default function ReportsPanel({ branches }: { branches: AdminBranch[] }) {
  const [period, setPeriod] = useState<ReportPeriod>('day');
  const [date, setDate] = useState(todayBolivia());
  const [branchId, setBranchId] = useState('');
  const [metric, setMetric] = useState<'count' | 'amount'>('count');
  const [report, setReport] = useState<ShipmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        setReport(await getShipmentReport({ period, date, branchId: branchId || undefined }));
        setError('');
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo generar el reporte.');
      } finally {
        setLoading(false);
      }
    },
    [period, date, branchId],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const series = report?.series ?? [];
  const maxValue = Math.max(1, ...series.map((point) => point[metric]));
  const labelStep = series.length > 16 ? Math.ceil(series.length / 10) : 1;
  const maxStatus = Math.max(1, ...Object.values(report?.byStatus ?? {}));
  const maxOrigin = Math.max(1, ...(report?.byOrigin.map((o) => o.count) ?? [0]));
  const maxRoute = Math.max(1, ...(report?.topRoutes.map((r) => r.count) ?? [0]));
  const isToday = date === todayBolivia();

  return (
    <section className="animate-fade-in space-y-6">
      {/* Cabecera solo visible al imprimir */}
      <div className="hidden border-b border-black/20 pb-4 print:block">
        <p className="text-2xl font-bold">NORTHSTAR · Reporte de encomiendas</p>
        <p className="text-sm">{report?.label}</p>
        <p className="text-xs">
          Generado el {report ? new Date(report.generatedAt).toLocaleString('es-BO') : ''}
          {branchId && ` · Sucursal: ${branches.find((b) => b.id === branchId)?.name ?? ''}`}
        </p>
      </div>

      {/* Controles */}
      <div className="no-print space-y-4 border border-white/10 bg-[#0d0f14] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Reportes de envíos</p>
            <h2 className="display-heading mt-1 text-2xl md:text-3xl">{report?.label ?? 'Generando reporte…'}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-white/15 bg-[#050811] p-1">
              {periods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  className={`btn-tactile px-4 py-2 text-xs font-extrabold uppercase tracking-wider ${
                    period === item.id ? 'bg-[#0077ff] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setDate(shiftDate(date, period, -1))} className="ns-btn-outline px-3 py-2" aria-label="Periodo anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            max={todayBolivia()}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            aria-label="Fecha del reporte"
            className="ns-input w-44 py-2"
          />
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, period, 1))}
            disabled={isToday}
            className="ns-btn-outline px-3 py-2 disabled:opacity-40"
            aria-label="Periodo siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setDate(todayBolivia())} className="ns-btn-outline px-3 py-2 text-xs">
            Hoy
          </button>

          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            aria-label="Filtrar por sucursal de origen"
            className="ns-input w-56 py-2 text-xs"
          >
            <option value="">Todas las sucursales</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="ns-btn-outline px-3 py-2" title="Actualizar">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" disabled={!report} onClick={() => report && exportCsv(report)} className="ns-btn-outline px-4 py-2 text-xs disabled:opacity-40">
              <Download className="h-4 w-4" />
              <span>Exportar CSV</span>
            </button>
            <button type="button" disabled={!report} onClick={printReport} className="ns-btn-primary px-4 py-2 text-xs disabled:opacity-40">
              <Printer className="h-4 w-4" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="border border-red-500/30 bg-red-950/30 p-3 text-sm font-semibold text-red-300">
          {error}
        </p>
      )}

      {!report && loading && (
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      )}

      {report && (
        <>
          {/* Indicadores */}
          <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            <div className="animate-fade-up bg-[#0d0f14] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">Encomiendas enviadas</p>
                  <AnimatedNumber value={report.totals.shipments} className="display-heading mt-1 block text-5xl" />
                </div>
                <span className="hex-badge"><Package className="h-5 w-5" /></span>
              </div>
              <div className="mt-2"><Delta current={report.totals.shipments} previous={report.previous.shipments} /></div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {report.totals.delivered} entregadas · {report.totals.inTransit} en ruta · {report.totals.cancelled} anuladas
              </p>
            </div>

            <div className="animate-fade-up bg-[#0d0f14] p-5" style={{ animationDelay: '60ms' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">Facturado</p>
                  <AnimatedNumber value={report.totals.billed} decimals={2} prefix="Bs " className="display-heading mt-1 block text-4xl text-gradient" />
                </div>
                <span className="hex-badge hex-badge-violet"><Wallet className="h-5 w-5" /></span>
              </div>
              <div className="mt-2"><Delta current={report.totals.billed} previous={report.previous.billed} /></div>
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>Ticket promedio {bs(report.totals.averageTicket)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Scale className="h-3.5 w-3.5 text-[#8b5cf6]" />
                  {report.totals.weightKg.toFixed(1)} kg
                </span>
              </p>
            </div>

            <div className="animate-fade-up bg-[#0d0f14] p-5" style={{ animationDelay: '120ms' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow">Cobrado vs. pendiente</p>
                  <AnimatedNumber value={report.totals.paidAmount} decimals={2} prefix="Bs " className="display-heading mt-1 block text-4xl text-emerald-400" />
                </div>
                <span className="hex-badge"><CheckCircle2 className="h-5 w-5" /></span>
              </div>
              <p className="mt-2 text-xs font-bold text-amber-300">Pendiente de cobro: {bs(report.totals.pendingAmount)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Caja: origen {bs(report.collected.origin)} · destino {bs(report.collected.destination)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-12">
            {/* Gráfico principal */}
            <div className="border border-white/10 bg-[#0d0f14] p-5 xl:col-span-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">{period === 'day' ? 'Envíos por hora' : 'Envíos por día'}</p>
                  <p className="text-sm font-semibold text-slate-400">
                    Pico: {series.reduce((best, point) => (point[metric] > best[metric] ? point : best), series[0] ?? { label: '—', count: 0, amount: 0, key: '' }).label}
                  </p>
                </div>
                <div className="no-print flex border border-white/15 bg-[#050811] p-1 text-xs font-extrabold uppercase">
                  {(['count', 'amount'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMetric(item)}
                      className={`btn-tactile px-3 py-1.5 ${metric === item ? 'bg-[#8b5cf6] text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {item === 'count' ? 'Cantidad' : 'Monto'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex h-56 items-stretch gap-1">
                {series.map((point, index) => {
                  const value = point[metric];
                  const pct = (value / maxValue) * 100;
                  return (
                    <div
                      key={`${report.from}-${metric}-${point.key}`}
                      className="group flex h-full min-w-0 flex-1 flex-col"
                      title={`${point.label}: ${point.count} guías · ${bs(point.amount)}`}
                    >
                      <div className="relative flex flex-1 items-end">
                        {value > 0 && (
                          <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-extrabold text-[#0077ff] opacity-0 transition-opacity group-hover:opacity-100">
                            {metric === 'count' ? value : Math.round(value)}
                          </span>
                        )}
                        <div
                          className="bar-grow w-full bg-gradient-to-t from-[#0077ff] to-[#8b5cf6] transition-[filter] group-hover:brightness-125"
                          style={{
                            height: `${value > 0 ? Math.max(pct, 4) : 1}%`,
                            animationDelay: `${index * 18}ms`,
                            opacity: value > 0 ? 1 : 0.2,
                          }}
                        />
                      </div>
                      <span className="mt-1 h-4 truncate text-center text-[10px] font-semibold text-slate-500">
                        {index % labelStep === 0 ? point.label : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Estados */}
            <div className="border border-white/10 bg-[#0d0f14] p-5 xl:col-span-4">
              <p className="eyebrow">Estado de las guías</p>
              <div className="mt-4 space-y-3.5">
                {(Object.keys(statusLabels) as ShipmentStatus[]).map((status, index) => {
                  const count = report.byStatus[status];
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-xs font-bold uppercase">
                        <span className="text-slate-400">{statusLabels[status]}</span>
                        <span>{count}</span>
                      </div>
                      <div className="mt-1 h-2 w-full bg-white/10">
                        <div
                          className={`bar-grow-x h-full ${statusColors[status]}`}
                          style={{ width: `${(count / maxStatus) * 100}%`, animationDelay: `${index * 80}ms` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="eyebrow mt-6">Modalidad de cobro</p>
              <div className="mt-3 space-y-2">
                {report.byPayment.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-500">Sin movimientos en este periodo.</p>
                ) : (
                  report.byPayment.map((item) => (
                    <div key={item.paymentType} className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
                      <span className="font-bold uppercase text-slate-300">{paymentLabels[item.paymentType]}</span>
                      <span className="font-semibold text-slate-400">{item.count} · {bs(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="border border-white/10 bg-[#0d0f14] p-5">
              <p className="eyebrow">Envíos por sucursal de origen</p>
              <div className="mt-4 space-y-3">
                {report.byOrigin.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-500">Sin envíos en este periodo.</p>
                ) : (
                  report.byOrigin.map((origin, index) => (
                    <div key={origin.code}>
                      <div className="flex items-center justify-between text-xs font-bold uppercase">
                        <span>{origin.code} · {origin.name}</span>
                        <span className="text-slate-400">{origin.count} · {bs(origin.amount)}</span>
                      </div>
                      <div className="mt-1 h-2 w-full bg-white/10">
                        <div className="bar-grow-x h-full bg-[#0077ff]" style={{ width: `${(origin.count / maxOrigin) * 100}%`, animationDelay: `${index * 80}ms` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border border-white/10 bg-[#0d0f14] p-5">
              <p className="eyebrow">Rutas más usadas</p>
              <div className="mt-4 space-y-3">
                {report.topRoutes.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-500">Sin envíos en este periodo.</p>
                ) : (
                  report.topRoutes.map((route, index) => (
                    <div key={route.route}>
                      <div className="flex items-center justify-between text-xs font-bold uppercase">
                        <span>{route.route}</span>
                        <span className="text-slate-400">{route.count} · {bs(route.amount)}</span>
                      </div>
                      <div className="mt-1 h-2 w-full bg-white/10">
                        <div className="bar-grow-x h-full bg-[#8b5cf6]" style={{ width: `${(route.count / maxRoute) * 100}%`, animationDelay: `${index * 80}ms` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Detalle */}
          <div className="border border-white/10 bg-[#0d0f14] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="hex-badge"><FileText className="h-4 w-4" /></span>
                <div>
                  <p className="eyebrow">Detalle del periodo</p>
                  <p className="text-sm font-semibold text-slate-400">
                    {report.rows.length} guía(s)
                    {report.rows.length > ON_SCREEN_ROWS && ` · mostrando ${ON_SCREEN_ROWS}; el CSV incluye todas`}
                    {report.truncated && ' · se alcanzó el límite máximo de filas'}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">Guía</th>
                    <th className="py-2.5 pr-3">Fecha</th>
                    <th className="py-2.5 pr-3">Ruta</th>
                    <th className="py-2.5 pr-3">Remitente → Consignatario</th>
                    <th className="py-2.5 pr-3">Estado</th>
                    <th className="py-2.5 pr-3">Cobro</th>
                    <th className="py-2.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center font-semibold text-slate-500">
                        No hay encomiendas registradas en este periodo.
                      </td>
                    </tr>
                  ) : (
                    report.rows.slice(0, ON_SCREEN_ROWS).map((row) => (
                      <tr key={row.guideNumber} className="border-b border-white/5 transition-colors hover:bg-[#0077ff]/10">
                        <td className="py-2.5 pr-3 font-extrabold text-[#0077ff]">#{row.guideNumber}</td>
                        <td className="py-2.5 pr-3 text-slate-400">{new Date(row.createdAt).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="py-2.5 pr-3 font-bold">{row.origin} → {row.destination}</td>
                        <td className="py-2.5 pr-3">{row.sender} → {row.consignee}</td>
                        <td className="py-2.5 pr-3 font-bold uppercase">{statusLabels[row.status]}</td>
                        <td className={`py-2.5 pr-3 font-bold uppercase ${row.isPaid ? 'text-emerald-400' : 'text-amber-300'}`}>
                          {row.isPaid ? 'Pagado' : 'Pendiente'}
                        </td>
                        <td className="py-2.5 text-right font-extrabold">{bs(row.totalAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
