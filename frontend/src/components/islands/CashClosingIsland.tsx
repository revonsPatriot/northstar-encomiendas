import { useCallback, useEffect, useState } from 'react';
import type { CashClosing, CashSummary } from '../../../../shared/types/shipment.types';
import { getSessionUser } from '../../services/api-client';
import { closeCash, getCashSummary, listCashClosings } from '../../services/shipment.service';

const bs = (value: number | string) => `Bs ${Number(value).toFixed(2)}`;

export default function CashClosingIsland() {
  const user = getSessionUser<{ branchId: string }>();
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [history, setHistory] = useState<CashClosing[]>([]);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [current, closings] = await Promise.all([
        getCashSummary(undefined, user?.branchId),
        listCashClosings(user?.branchId),
      ]);
      setSummary(current);
      setHistory(closings);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar la caja.');
    }
  }, [user?.branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const difference =
    summary && counted !== '' ? Number(counted) - summary.expectedTotal : null;

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!summary) return;
    setSaving(true);
    setMessage('');
    try {
      await closeCash(Number(counted), notes, summary.date, user?.branchId);
      setCounted('');
      setNotes('');
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No se pudo guardar el arqueo.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="animate-fade-up grid gap-8 xl:grid-cols-12">
      <div className="border border-white/10 bg-[#0b0e14] p-6 md:p-8 xl:col-span-7">
        <p className="eyebrow">Cierre operativo · {summary?.date ?? ''}</p>
        <h2 className="display-heading mt-3 text-3xl">Cuadre diario de caja</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="border border-white/10 bg-[#07090d] p-5">
            <p className="eyebrow">Cobrado en origen</p>
            <p className="mt-2 text-3xl font-black">
              {bs(summary?.origin.amount ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary?.origin.count ?? 0} cobros
            </p>
          </div>
          <div className="border border-white/10 bg-[#07090d] p-5">
            <p className="eyebrow">Cobrado en destino</p>
            <p className="mt-2 text-3xl font-black text-zinc-300">
              {bs(summary?.destination.amount ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary?.destination.count ?? 0} cobros
            </p>
          </div>
          <div className="border border-white bg-[#07090d] p-5">
            <p className="eyebrow">Efectivo esperado</p>
            <p className="mt-2 text-3xl font-black">
              {bs(summary?.expectedTotal ?? 0)}
            </p>
          </div>
        </div>
        {message && (
          <p
            role="alert"
            className="mt-6 border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300"
          >
            {message}
          </p>
        )}
        {summary?.closing ? (
          <div className="mt-8 border border-emerald-500/30 bg-emerald-950/20 p-5 text-sm text-emerald-200">
            <p className="font-bold uppercase">Arqueo ya registrado hoy</p>
            <p className="mt-2">
              Contado {bs(summary.closing.countedCash)} · Diferencia{' '}
              {bs(summary.closing.difference)}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Efectivo contado en caja
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={counted}
                onChange={(event) => setCounted(event.target.value)}
                placeholder="0.00"
                className="ns-input mt-2 py-3"
              />
            </label>
            {difference !== null && (
              <p
                className={`text-sm font-bold ${
                  difference === 0 ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {difference === 0
                  ? 'La caja cuadra exactamente.'
                  : `Diferencia: ${bs(difference)} ${
                      difference > 0 ? '(sobrante)' : '(faltante)'
                    }`}
              </p>
            )}
            <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Observaciones
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="ns-input mt-2 py-3"
              />
            </label>
            <button disabled={saving} className="ns-btn-primary w-full py-4">
              {saving ? 'Guardando...' : 'Guardar arqueo →'}
            </button>
          </form>
        )}
      </div>

      <div className="border border-white/10 bg-[#0b0e14] p-6 md:p-8 xl:col-span-5">
        <p className="eyebrow">Auditoría de cierres</p>
        <h3 className="mt-2 text-2xl font-black uppercase">Historial de Arqueos</h3>
        <div className="mt-6 divide-y divide-white/10 text-sm">
          {history.length === 0 ? (
            <p className="text-slate-500">
              Aún no hay arqueos registrados para esta sucursal.
            </p>
          ) : (
            history.map((closing) => (
              <div
                key={closing.id}
                className="grid grid-cols-2 gap-2 py-3.5 sm:grid-cols-4"
              >
                <span className="font-bold">{closing.closingDate.slice(0, 10)}</span>
                <span>Contado {bs(closing.countedCash)}</span>
                <span
                  className={
                    Number(closing.difference) === 0
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }
                >
                  Dif. {bs(closing.difference)}
                </span>
                <span className="text-slate-500">{closing.user?.fullName}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
