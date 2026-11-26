import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Wallet,
} from 'lucide-react';
import type { DashboardStats } from '../../../../shared/types/shipment.types';
import { getSessionUser } from '../../services/api-client';
import { getDashboard } from '../../services/shipment.service';

export default function DashboardIsland() {
  const user = getSessionUser<{ branchId: string }>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard(user?.branchId)
      .then(setStats)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : 'No se pudieron cargar las métricas.',
        ),
      );
  }, [user?.branchId]);

  const cards = [
    {
      label: 'EMITIDAS HOY',
      value: stats ? String(stats.registeredToday) : '—',
      Icon: Package,
      accent: false,
    },
    {
      label: 'EN DESTINO (RECOJO)',
      value: stats ? String(stats.readyForDelivery) : '—',
      Icon: CheckCircle2,
      accent: true,
    },
    {
      label: 'EN RUTA A SUCURSAL',
      value: stats ? String(stats.incoming) : '—',
      Icon: Truck,
      accent: false,
    },
    {
      label: 'POR DESPACHAR',
      value: stats ? String(stats.outgoingPending) : '—',
      Icon: Clock,
      accent: false,
    },
    {
      label: 'CAJA DEL DÍA',
      value: stats ? `BS ${stats.cashToday.toFixed(0)}` : 'BS —',
      Icon: Wallet,
      accent: true,
    },
  ];

  return (
    <>
      {error && (
        <p
          role="alert"
          className="mb-4 border border-red-500/30 bg-red-950/30 p-3 text-xs font-bold uppercase text-red-300"
        >
          {error}
        </p>
      )}
      <section className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(({ label, value, Icon, accent }, idx) => (
          <div
            key={label}
            style={{ animationDelay: `${idx * 50}ms` }}
            className="animate-fade-up card-interactive flex items-center justify-between bg-[#0d0f14] p-6"
          >
            <div>
              <p className="eyebrow">{label}</p>
              <p
                className={`display-heading mt-2 text-5xl ${
                  accent ? 'text-[#FFB800]' : ''
                }`}
              >
                {value}
              </p>
            </div>
            <span className="hex-badge">
              <Icon className="h-5 w-5" />
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
