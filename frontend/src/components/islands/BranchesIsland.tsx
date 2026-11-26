import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Package,
  Phone,
  Route as RouteIcon,
  Scale,
  Sparkles,
  Truck,
  UserPlus,
} from 'lucide-react';
import type { Branch, PublicOverview } from '../../../../shared/types/shipment.types';
import {
  BOLIVIA_DEPARTMENTS,
  BOLIVIA_VIEWBOX,
  normalizeName,
  projectLonLat,
} from '../../lib/bolivia-map';
import { getPublicOverview } from '../../services/shipment.service';
import AnimatedNumber from '../ui/AnimatedNumber';

const POLL_MS = 20_000;

/** Capitales departamentales [lon, lat]. */
const CAPITALS: Record<string, [number, number]> = {
  'la paz': [-68.1193, -16.4897],
  oruro: [-67.106, -17.9647],
  potosi: [-65.7531, -19.5836],
  cochabamba: [-66.157, -17.3935],
  chuquisaca: [-65.2627, -19.0333],
  tarija: [-64.7296, -21.5355],
  'santa cruz': [-63.1821, -17.7833],
  beni: [-64.9, -14.8333],
  pando: [-68.7692, -11.0267],
};
const EL_ALTO: [number, number] = [-68.19, -16.505];
const DEPT_HUES = [212, 252, 190, 270, 225, 200, 262, 238, 182];

interface MapNode {
  branch: Branch;
  x: number;
  y: number;
  side: 'top' | 'left' | 'right';
}

function baseCoord(branch: Branch): { x: number; y: number } {
  const key = normalizeName(branch.department);
  const isAlto = normalizeName(`${branch.name} ${branch.code}`).includes('alto');
  const geo = isAlto ? EL_ALTO : CAPITALS[key];
  if (geo) return projectLonLat(geo[0], geo[1]);
  const dept = BOLIVIA_DEPARTMENTS.find((d) => normalizeName(d.name) === key);
  if (dept) return { x: dept.cx, y: dept.cy };
  return { x: BOLIVIA_VIEWBOX.width / 2, y: BOLIVIA_VIEWBOX.height / 2 };
}

/** Separa nodos que quedarían superpuestos (p. ej. La Paz y El Alto). */
function spreadNodes(
  points: Array<{ x: number; y: number }>,
  minDistance = 26,
): Array<{ x: number; y: number }> {
  const result = points.map((p) => ({ ...p }));
  for (let iteration = 0; iteration < 50; iteration += 1) {
    let moved = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i];
        const b = result[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDistance) continue;
        if (dist < 0.01) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const push = (minDistance - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return result;
}

function curvePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(70, len * 0.3);
  const nx = -dy / len;
  const ny = dx / len;
  const sign = ny < 0 ? 1 : -1; // el arco siempre se curva hacia arriba
  return `M ${a.x} ${a.y} Q ${mx + nx * bend * sign} ${my + ny * bend * sign} ${b.x} ${b.y}`;
}

const money = (value: number | string) => Number(value).toFixed(0);

export default function BranchesIsland({
  mode = 'carousel',
}: {
  mode?: 'carousel' | 'grid';
}) {
  const [overview, setOverview] = useState<PublicOverview | null>(null);
  const [originId, setOriginId] = useState('');
  const [destId, setDestId] = useState('');
  const [selecting, setSelecting] = useState<'origin' | 'dest'>('dest');
  const [weightKg, setWeightKg] = useState(10);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const hasData = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await getPublicOverview();
      hasData.current = true;
      setOverview(data);
      setUpdatedAt(new Date());
      setFailed(false);
      const first = data.routes[0];
      if (first) {
        setOriginId((current) => current || first.originBranchId);
        setDestId((current) => current || first.destinationBranchId);
      }
    } catch {
      if (!hasData.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    setHasSession(Boolean(localStorage.getItem('northstar_access_token')));
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const nodes = useMemo<MapNode[]>(() => {
    if (!overview) return [];
    const spread = spreadNodes(overview.branches.map(baseCoord));
    return overview.branches.map((branch, index) => {
      const me = spread[index];
      const nearest = spread
        .map((other, j) => ({ other, j, d: Math.hypot(other.x - me.x, other.y - me.y) }))
        .filter((entry) => entry.j !== index)
        .sort((a, b) => a.d - b.d)[0];
      let side: MapNode['side'] = 'top';
      if (nearest && nearest.d < 50) side = me.x <= nearest.other.x ? 'left' : 'right';
      return { branch, x: me.x, y: me.y, side };
    });
  }, [overview]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.branch.id, n])), [nodes]);
  const originNode = nodeById.get(originId);
  const destNode = nodeById.get(destId);
  const originBranch = originNode?.branch;
  const destBranch = destNode?.branch;

  const activeRoute = useMemo(
    () =>
      overview?.routes.find(
        (r) => r.originBranchId === originId && r.destinationBranchId === destId,
      ),
    [overview, originId, destId],
  );

  const totalPrice = activeRoute
    ? Math.round(
        (Number(activeRoute.basePrice) + weightKg * Number(activeRoute.pricePerKg)) * 100,
      ) / 100
    : null;

  const departments = useMemo(
    () => (overview ? Array.from(new Set(overview.branches.map((b) => b.department))) : []),
    [overview],
  );

  const filteredBranches = useMemo(() => {
    if (!overview) return [];
    return departmentFilter
      ? overview.branches.filter((b) => b.department === departmentFilter)
      : overview.branches;
  }, [overview, departmentFilter]);

  const deptHasBranch = useCallback(
    (name: string) =>
      Boolean(overview?.branches.some((b) => normalizeName(b.department) === normalizeName(name))),
    [overview],
  );

  function pickBranch(branchId: string) {
    if (branchId === originId) return setSelecting('origin');
    if (branchId === destId) return setSelecting('dest');
    if (selecting === 'origin') {
      setOriginId(branchId);
      setSelecting('dest');
    } else {
      setDestId(branchId);
      setSelecting('origin');
    }
  }

  function pickDepartment(name: string) {
    if (!overview) return;
    const inDept = overview.branches.filter(
      (b) => normalizeName(b.department) === normalizeName(name),
    );
    if (inDept.length === 0) return;
    // Si hay varias sucursales (p. ej. La Paz y El Alto) alterna entre ellas.
    const next = inDept.find((b) => b.id !== originId && b.id !== destId) ?? inDept[0];
    pickBranch(next.id);
  }

  function swap() {
    setOriginId(destId);
    setDestId(originId);
  }

  if (failed) {
    return (
      <div className="ns-container py-10">
        <p className="border border-red-500/30 bg-red-950/20 p-4 text-sm font-semibold text-red-300">
          No se pudo conectar con el servidor. Verifica que el backend esté activo.
        </p>
      </div>
    );
  }

  const activePath = originNode && destNode ? curvePath(originNode, destNode) : null;
  const quickRoutes = overview?.routes.slice(0, 6) ?? [];
  const tickerItems = overview?.routes ?? [];

  return (
    <div className="space-y-12">
      {/* Franja de rutas en movimiento */}
      {mode === 'carousel' && tickerItems.length > 0 && (
        <div className="ticker border-y border-white/10 bg-[#0b101e] py-3">
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={copy === 1}>
                {tickerItems.map((route) => (
                  <span
                    key={`${copy}-${route.id}`}
                    className="inline-flex items-center gap-2.5 whitespace-nowrap text-xs font-bold uppercase tracking-[0.16em] text-slate-400"
                  >
                    <Truck className="h-3.5 w-3.5 text-[#0077ff]" />
                    <span className="text-white">
                      {route.originBranch?.code} → {route.destinationBranch?.code}
                    </span>
                    <span className="text-[#0077ff]">Bs {money(route.basePrice)}</span>
                    <span>~{route.estimatedHours ?? 8} h</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas animadas */}
      {mode === 'carousel' && (
        <section className="ns-container">
          <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 lg:grid-cols-4">
            {[
              [Building2, 'Sucursales', overview?.metrics.activeBranches ?? 0, 'hex-badge'],
              [RouteIcon, 'Rutas activas', overview?.metrics.activeRoutes ?? 0, 'hex-badge hex-badge-violet'],
              [Package, 'Envíos gestionados', overview?.metrics.totalShipments ?? 0, 'hex-badge'],
              [CheckCircle2, 'Entregas', overview?.metrics.deliveredShipments ?? 0, 'hex-badge hex-badge-violet'],
            ].map(([Icon, label, value, badge], idx) => {
              const Comp = Icon as typeof Building2;
              return (
                <div
                  key={String(label)}
                  style={{ animationDelay: `${idx * 70}ms` }}
                  className="animate-fade-up card-interactive flex items-center justify-between bg-[#0b101e] px-6 py-6"
                >
                  <div>
                    <p className="eyebrow">{String(label)}</p>
                    {overview ? (
                      <AnimatedNumber value={Number(value)} className="display-heading mt-1 block text-4xl" />
                    ) : (
                      <div className="skeleton mt-2 h-9 w-16" />
                    )}
                  </div>
                  <span className={String(badge)}>
                    <Comp className="h-5 w-5" />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Mapa interactivo + cotizador */}
      <section className="ns-container">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Cotizador interactivo</p>
            <h2 className="display-heading mt-1 text-3xl md:text-5xl">
              Marca tu ruta en el <span className="text-gradient">mapa</span>
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span className="live-dot" />
            <span>
              En vivo
              {updatedAt && ` · ${updatedAt.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-12">
          {/* MAPA */}
          <div className="relative overflow-hidden border border-white/15 bg-[#0b101e] p-4 md:p-6 xl:col-span-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2 text-xs font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setSelecting('origin')}
                  className={`btn-tactile flex items-center gap-2 border px-3 py-2 ${
                    selecting === 'origin' ? 'border-[#0077ff] bg-[#0077ff] text-white' : 'border-white/15 text-slate-300'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0077ff] ring-2 ring-white/60" />
                  Origen · {originBranch?.code ?? '—'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelecting('dest')}
                  className={`btn-tactile flex items-center gap-2 border px-3 py-2 ${
                    selecting === 'dest' ? 'border-[#8b5cf6] bg-[#8b5cf6] text-white' : 'border-white/15 text-slate-300'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6] ring-2 ring-white/60" />
                  Destino · {destBranch?.code ?? '—'}
                </button>
              </div>
              <button type="button" onClick={swap} className="ns-btn-outline px-3 py-2 text-xs" title="Invertir origen y destino">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>Invertir</span>
              </button>
            </div>

            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-[#8b5cf6]" />
              {selecting === 'origin'
                ? 'Toca un departamento con sucursal para elegir el ORIGEN'
                : 'Toca un departamento con sucursal para elegir el DESTINO'}
            </p>

            <div className="flex justify-center">
              <svg
                viewBox={`0 0 ${BOLIVIA_VIEWBOX.width} ${BOLIVIA_VIEWBOX.height}`}
                className="h-auto max-h-[560px] w-full max-w-[560px] select-none"
                role="img"
                aria-label="Mapa interactivo de Bolivia con sus departamentos y sucursales"
              >
                <defs>
                  {originNode && destNode && (
                    <linearGradient
                      id="routeGradient"
                      gradientUnits="userSpaceOnUse"
                      x1={originNode.x}
                      y1={originNode.y}
                      x2={destNode.x}
                      y2={destNode.y}
                    >
                      <stop offset="0%" stopColor="#0077ff" />
                      <stop offset="55%" stopColor="#00e5ff" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  )}
                  <filter id="mapGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {BOLIVIA_DEPARTMENTS.map((dept, index) => {
                  const has = deptHasBranch(dept.name);
                  const isOrigin = originBranch && normalizeName(originBranch.department) === normalizeName(dept.name);
                  const isDest = destBranch && normalizeName(destBranch.department) === normalizeName(dept.name);
                  return (
                    <g key={dept.name}>
                      <path
                        d={dept.path}
                        fillRule="evenodd"
                        className={`dept-shape ${has ? 'has-branch' : ''} ${isOrigin ? 'is-origin' : ''} ${isDest ? 'is-dest' : ''}`}
                        style={{ '--h': DEPT_HUES[index % DEPT_HUES.length] } as CSSProperties}
                        onClick={() => pickDepartment(dept.name)}
                      >
                        <title>{has ? `${dept.name} · con sucursal` : `${dept.name} · sin sucursal`}</title>
                      </path>
                      <text
                        x={dept.cx}
                        y={dept.cy + (has ? 24 : 4)}
                        textAnchor="middle"
                        className="pointer-events-none"
                        style={{
                          fill: 'var(--ns-text-muted)',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          opacity: has ? 0.95 : 0.55,
                        }}
                      >
                        {dept.name}
                      </text>
                    </g>
                  );
                })}

                {/* Rutas de fondo */}
                {overview?.routes.map((route) => {
                  const a = nodeById.get(route.originBranchId);
                  const b = nodeById.get(route.destinationBranchId);
                  if (!a || !b) return null;
                  return (
                    <path key={route.id} d={curvePath(a, b)} fill="none" stroke="rgba(0,119,255,0.16)" strokeWidth="1.4" />
                  );
                })}

                {/* Ruta activa */}
                {activePath && (
                  <g key={`${originId}-${destId}`}>
                    <path d={activePath} fill="none" stroke="url(#routeGradient)" strokeWidth="6" opacity="0.35" filter="url(#mapGlow)" />
                    <path d={activePath} fill="none" stroke="url(#routeGradient)" strokeWidth="3" className="animate-route-flow" />
                    <circle r="5.5" fill="#ffffff" filter="url(#mapGlow)">
                      <animateMotion dur="2.4s" repeatCount="indefinite" path={activePath} />
                    </circle>
                  </g>
                )}

                {/* Sucursales */}
                {nodes.map(({ branch, x, y, side }) => {
                  const isOrigin = branch.id === originId;
                  const isDest = branch.id === destId;
                  const active = isOrigin || isDest;
                  const color = isOrigin ? '#0077ff' : isDest ? '#8b5cf6' : '#38bdf8';
                  const label =
                    side === 'top'
                      ? { x, y: y - 15, anchor: 'middle' as const }
                      : side === 'left'
                        ? { x: x - 14, y: y + 4, anchor: 'end' as const }
                        : { x: x + 14, y: y + 4, anchor: 'start' as const };
                  return (
                    <g
                      key={branch.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${branch.name}, ${branch.department}`}
                      className="cursor-pointer outline-none"
                      onClick={(event) => {
                        event.stopPropagation();
                        pickBranch(branch.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          pickBranch(branch.id);
                        }
                      }}
                    >
                      {active && <circle cx={x} cy={y} r="11" fill={color} opacity="0.5" className="map-ripple" />}
                      <circle cx={x} cy={y} r={active ? 8.5 : 6.5} fill={color} stroke="#ffffff" strokeWidth="2.2" />
                      <text
                        x={label.x}
                        y={label.y}
                        textAnchor={label.anchor}
                        style={{
                          fill: 'var(--ns-text)',
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          stroke: 'var(--ns-surface)',
                          strokeWidth: 3.5,
                          paintOrder: 'stroke',
                        }}
                        className="pointer-events-none"
                      >
                        {branch.code}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0077ff]" />Origen</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />Destino</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />Sucursal</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-600" />Sin cobertura</span>
            </div>
          </div>

          {/* COTIZACIÓN */}
          <div className="flex flex-col gap-5 border border-white/15 bg-[#0b101e] p-6 xl:col-span-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="eyebrow">Precio en tiempo real</span>
                <h3 className="display-heading mt-1 text-3xl">Tu cotización</h3>
              </div>
              <span className="hex-badge">
                <Navigation className="h-5 w-5" />
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase text-slate-400">
                Desde
                <select value={originId} onChange={(e) => setOriginId(e.target.value)} className="ns-input mt-1.5">
                  {overview?.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} · {b.department}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold uppercase text-slate-400">
                Hasta
                <select value={destId} onChange={(e) => setDestId(e.target.value)} className="ns-input mt-1.5">
                  {overview?.branches.filter((b) => b.id !== originId).map((b) => (
                    <option key={b.id} value={b.id}>{b.code} · {b.department}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="border border-white/10 bg-[#050811] p-4">
              <div className="flex items-center justify-between text-xs font-bold uppercase">
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <Scale className="h-4 w-4 text-[#0077ff]" />
                  Peso
                </span>
                <span className="display-heading text-2xl text-[#0077ff]">{weightKg} kg</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                aria-label="Peso en kilogramos"
                className="mt-3 w-full accent-[#0077ff]"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 5, 10, 25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWeightKg(preset)}
                    className={`btn-tactile px-2.5 py-1 text-[11px] font-bold uppercase ${
                      weightKg === preset ? 'bg-[#0077ff] text-white' : 'border border-white/15 text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset} kg
                  </button>
                ))}
              </div>
            </div>

            {activeRoute && totalPrice !== null ? (
              <div className="animate-fade-in border border-[#0077ff]/40 bg-[#050811] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="eyebrow">Precio estimado</span>
                    <AnimatedNumber value={totalPrice} decimals={2} prefix="Bs " className="display-heading mt-1 block text-5xl text-gradient" />
                  </div>
                  <div className="border border-white/15 px-3.5 py-2 text-right">
                    <span className="block text-[10px] font-bold uppercase text-slate-500">Tránsito</span>
                    <strong className="display-heading inline-flex items-center gap-1 text-2xl">
                      <Clock className="h-4 w-4 text-[#8b5cf6]" />~{activeRoute.estimatedHours ?? 8} h
                    </strong>
                  </div>
                </div>
                <p className="mt-3 border-t border-white/10 pt-3 text-xs font-semibold text-slate-400">
                  Base Bs {Number(activeRoute.basePrice).toFixed(2)} + Bs {Number(activeRoute.pricePerKg).toFixed(2)} por kg
                </p>
              </div>
            ) : (
              <div className="border border-white/10 bg-[#050811] p-5 text-sm font-semibold text-slate-400">
                No hay tarifa directa entre estas sucursales. Prueba con otra combinación.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <a href={hasSession ? '/sucursal/registrar' : '/registro'} className="ns-btn-primary flex-1">
                <UserPlus className="h-4 w-4" />
                <span>{hasSession ? 'Emitir este envío' : 'Crear cuenta y enviar'}</span>
              </a>
              <a href="/#rastreo" className="ns-btn-outline">
                <span>Rastrear</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {quickRoutes.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Rutas frecuentes</p>
                <div className="flex flex-wrap gap-2">
                  {quickRoutes.map((route) => {
                    const selected = route.originBranchId === originId && route.destinationBranchId === destId;
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => {
                          setOriginId(route.originBranchId);
                          setDestId(route.destinationBranchId);
                        }}
                        className={`btn-tactile border px-3 py-1.5 text-xs font-bold uppercase ${
                          selected ? 'chip-violet' : 'border-white/15 text-slate-400 hover:border-[#8b5cf6] hover:text-[#8b5cf6]'
                        }`}
                      >
                        {route.originBranch?.code} → {route.destinationBranch?.code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Vista completa: tarifario y sucursales */}
      {mode === 'grid' && (
        <>
          <section className="ns-container">
            <div className="mb-5 border-b border-white/10 pb-4">
              <p className="eyebrow">Tarifario oficial</p>
              <h2 className="display-heading mt-1 text-3xl md:text-4xl">Todas las rutas</h2>
            </div>
            <div className="overflow-x-auto border border-white/10 bg-[#0b101e]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Ruta</th>
                    <th className="px-4 py-3">Tarifa base</th>
                    <th className="px-4 py-3">Por kg</th>
                    <th className="px-4 py-3">Tiempo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {overview?.routes.map((route) => {
                    const selected = route.originBranchId === originId && route.destinationBranchId === destId;
                    return (
                      <tr
                        key={route.id}
                        className={`border-b border-white/5 transition-colors hover:bg-[#0077ff]/10 ${selected ? 'bg-[#8b5cf6]/10' : ''}`}
                      >
                        <td className="px-4 py-3 font-bold uppercase">
                          {route.originBranch?.name} → {route.destinationBranch?.name}
                        </td>
                        <td className="px-4 py-3 font-bold text-[#0077ff]">Bs {Number(route.basePrice).toFixed(2)}</td>
                        <td className="px-4 py-3">+Bs {Number(route.pricePerKg).toFixed(2)}</td>
                        <td className="px-4 py-3">~{route.estimatedHours ?? 8} h</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setOriginId(route.originBranchId);
                              setDestId(route.destinationBranchId);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-xs font-bold uppercase text-[#8b5cf6] hover:underline"
                          >
                            Ver en mapa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section id="oficinas" className="ns-container pb-10">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="eyebrow">Red propia</p>
                <h2 className="display-heading mt-1 text-3xl md:text-4xl">Sucursales por departamento</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {['', ...departments].map((dept) => (
                  <button
                    key={dept || 'all'}
                    type="button"
                    onClick={() => setDepartmentFilter(dept)}
                    className={`btn-tactile border px-3.5 py-2 text-xs font-bold uppercase ${
                      departmentFilter === dept
                        ? 'border-[#0077ff] bg-[#0077ff] text-white'
                        : 'border-white/15 text-slate-400 hover:border-[#0077ff]'
                    }`}
                  >
                    {dept || `Todos (${overview?.branches.length ?? 0})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {filteredBranches.map((branch, idx) => (
                <button
                  type="button"
                  key={branch.id}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() => {
                    pickBranch(branch.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="animate-fade-up card-interactive flex flex-col justify-between border border-white/10 bg-[#0b101e] p-5 text-left"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="border border-[#0077ff] bg-[#0077ff]/10 px-2.5 py-0.5 text-xs font-extrabold text-[#0077ff]">
                        {branch.code}
                      </span>
                      <Truck className="h-4 w-4 text-slate-500" />
                    </div>
                    <h3 className="display-heading mt-3 text-2xl">{branch.name}</h3>
                    <p className="text-xs font-bold uppercase text-[#8b5cf6]">{branch.department}</p>
                    <p className="mt-3 flex items-start gap-2 text-xs text-slate-300">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0077ff]" />
                      <span>{branch.address}</span>
                    </p>
                  </div>
                  {branch.phones && (
                    <p className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs font-bold text-slate-400">
                      <Phone className="h-3.5 w-3.5 text-[#0077ff]" />
                      <span>{branch.phones}</span>
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
