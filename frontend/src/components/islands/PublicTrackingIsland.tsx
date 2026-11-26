import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  History,
  MapPin,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  PublicTracking,
  ShipmentStatus,
} from '../../../../shared/types/shipment.types';
import { trackShipment } from '../../services/shipment.service';

const RECENT_KEY = 'northstar_recent_guides';

const labels: Record<ShipmentStatus, string> = {
  REGISTRADO: 'En origen',
  EN_TRANSITO: 'En ruta',
  EN_SUCURSAL_DESTINO: 'En destino',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
};

const stepOrder: ShipmentStatus[] = [
  'REGISTRADO',
  'EN_TRANSITO',
  'EN_SUCURSAL_DESTINO',
  'ENTREGADO',
];

const fmt = (value: string) =>
  new Date(value).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

export default function PublicTrackingIsland() {
  const [guide, setGuide] = useState('');
  const [shipment, setShipment] = useState<PublicTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRecent(readRecent());
    const fromUrl = new URLSearchParams(window.location.search).get('guia');
    if (fromUrl) {
      setGuide(fromUrl);
      void track(fromUrl);
    }
  }, []);

  async function track(rawGuide: string) {
    const value = rawGuide.trim();
    if (!value) return;
    setLoading(true);
    setMessage('');
    setShipment(null);
    try {
      const result = await trackShipment(value);
      setShipment(result);
      const next = [value, ...readRecent().filter((g) => g !== value)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecent(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No encontramos esa guía.');
    } finally {
      setLoading(false);
    }
  }

  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  }

  async function copyLink() {
    if (!shipment) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?guia=${shipment.guideNumber}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* el navegador puede bloquear el portapapeles */
    }
  }

  const currentStep = shipment ? stepOrder.indexOf(shipment.status) : -1;

  return (
    <div id="rastreo" className="animate-fade-up border border-white/15 bg-[#0b101e]/95 p-6 shadow-2xl backdrop-blur-xl md:p-8">
      <div className="flex items-center gap-3 border-b border-white/10 pb-5">
        <span className="hex-badge">
          <Search className="h-4 w-4" />
        </span>
        <div>
          <p className="eyebrow">Sin registro · Gratis</p>
          <h2 className="display-heading text-3xl">Rastrea tu guía</h2>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void track(guide);
        }}
        className="mt-6 flex flex-col gap-2.5 sm:flex-row"
      >
        <input
          value={guide}
          onChange={(event) => setGuide(event.target.value)}
          required
          inputMode="numeric"
          pattern="[0-9]{1,12}"
          aria-label="Número de guía"
          placeholder="Número de guía"
          className="ns-input flex-1 py-3.5 text-lg font-bold tracking-wider"
        />
        <button disabled={loading} className="ns-btn-primary px-7">
          <span>{loading ? 'Buscando…' : 'Buscar'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {recent.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <History className="h-3.5 w-3.5" />
          <span>Recientes</span>
          {recent.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setGuide(item);
                void track(item);
              }}
              className="btn-tactile border border-white/15 bg-[#050811] px-2.5 py-1 text-slate-300 transition hover:border-[#0077ff] hover:text-[#0077ff]"
            >
              #{item}
            </button>
          ))}
          <button type="button" onClick={clearRecent} className="text-slate-500 hover:text-red-400" aria-label="Borrar historial">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-6 space-y-3" aria-hidden>
          <div className="skeleton h-10 w-2/3" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      )}

      {message && (
        <p role="alert" className="animate-fade-in mt-4 border border-red-500/30 bg-red-950/30 p-3 text-sm font-semibold text-red-300">
          {message}
        </p>
      )}

      {shipment && (
        <div className="animate-fade-in mt-6 border border-white/15 bg-[#050811] p-5">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="eyebrow">Guía verificada</span>
              <p className="display-heading mt-0.5 text-4xl">#{shipment.guideNumber}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="chip-violet px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider">
                {labels[shipment.status]}
              </span>
              <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-[#0077ff]">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar enlace'}
              </button>
            </div>
          </div>

          {shipment.status !== 'ANULADO' && (
            <div className="mt-5 grid grid-cols-4 gap-2">
              {stepOrder.map((step, idx) => {
                const active = idx <= currentStep;
                return (
                  <div key={step} className="space-y-1.5">
                    <div className="h-1.5 w-full overflow-hidden bg-white/10">
                      <div
                        className={`bar-grow-x h-full ${active ? 'bg-gradient-to-r from-[#0077ff] to-[#8b5cf6]' : ''}`}
                        style={{ animationDelay: `${idx * 140}ms`, width: active ? '100%' : '0%' }}
                      />
                    </div>
                    <p className={`text-[10px] font-extrabold uppercase tracking-wider ${active ? 'text-[#0077ff]' : 'text-slate-500'}`}>
                      {labels[step]}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 grid gap-3 border-y border-white/10 py-4 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-[#0077ff]" />
              <div>
                <span className="block text-[10px] uppercase text-slate-500">Ruta</span>
                <strong className="uppercase">
                  {shipment.originBranch.name} → {shipment.destinationBranch.name}
                </strong>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <UserCheck className="h-4 w-4 shrink-0 text-[#8b5cf6]" />
              <div>
                <span className="block text-[10px] uppercase text-slate-500">Recibe</span>
                <strong className="uppercase">{shipment.consigneeName}</strong>
              </div>
            </div>
          </div>

          <ol className="mt-4 space-y-3 border-l-2 border-[#0077ff]/40 pl-4">
            {shipment.history.map((event, index) => (
              <li
                key={index}
                style={{ animationDelay: `${index * 90}ms` }}
                className="animate-fade-up relative flex flex-wrap items-center justify-between gap-1 text-xs"
              >
                <span className="absolute -left-[22px] h-2.5 w-2.5 rounded-full bg-[#0077ff] ring-4 ring-[#0077ff]/20" />
                <span className="font-bold uppercase">
                  {labels[event.status]} · {event.branch}
                </span>
                <span className="text-slate-500">{fmt(event.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
