import { useCallback, useEffect, useState } from 'react';
import type { Shipment } from '../../../../shared/types/shipment.types';
import { getSessionUser } from '../../services/api-client';
import { confirmDelivery, listDestinationShipments } from '../../services/shipment.service';
import ConfirmModal from '../ui/ConfirmModal';

const PAGE = 25;

export default function PickupDeliveryIsland() {
  const user = getSessionUser<{ branchId: string }>();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Shipment | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.branchId) return;
    setLoading(true);
    try {
      const page = await listDestinationShipments(user.branchId, query, skip);
      setShipments(page.items);
      setTotal(page.total);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar la bandeja.');
    } finally {
      setLoading(false);
    }
  }, [user?.branchId, query, skip]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 250);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function deliver(receiverCi: string, payOnDelivery: boolean, notes: string) {
    if (!selected) return;
    try {
      await confirmDelivery(selected.guideNumber, receiverCi, payOnDelivery, notes);
      setSelected(null);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo confirmar la entrega.');
      throw error;
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Bandeja de destino</p>
          <h2 className="display-heading mt-3 text-3xl">Encomiendas listas para entrega</h2>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => { setSkip(0); setQuery(event.target.value); }}
            placeholder="Buscar guía, nombre o C.I."
            aria-label="Buscar encomiendas"
            className="w-64 border border-white/15 bg-[#07090d] px-3 py-2 text-sm outline-none focus:border-[#d4d4d8]"
          />
          <button onClick={() => void refresh()} className="border border-white/20 px-4 py-2 text-xs font-bold uppercase hover:border-[#d4d4d8]">Actualizar</button>
        </div>
      </div>
      {message && <p role="alert" className="mb-4 border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">{message}</p>}
      <div className="overflow-hidden border border-white/10 bg-[#0b0e14]">
        <div className="hidden grid-cols-[120px_1fr_1fr_130px_130px] gap-4 border-b border-white/10 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 md:grid"><span>Guía</span><span>Consignatario</span><span>Remitente</span><span>Modalidad</span><span></span></div>
        {loading && shipments.length === 0 ? <p className="p-10 text-center text-slate-500">Cargando...</p> : shipments.length === 0 ? <p className="p-10 text-center text-slate-500">No hay encomiendas pendientes de entrega.</p> : shipments.map((shipment) => {
          const unpaid = shipment.paymentType === 'POR_PAGAR' && !shipment.isPaid;
          return <div key={shipment.id} className={`grid gap-3 border-b border-white/10 px-5 py-5 md:grid-cols-[120px_1fr_1fr_130px_130px] md:items-center ${unpaid ? 'border-l-4 border-l-red-500 bg-red-950/20' : ''}`}>
            <div><p className="text-xs text-slate-500 md:hidden">Guía</p><strong className="text-lg">{shipment.guideNumber}</strong></div>
            <div><p className="text-xs text-slate-500 md:hidden">Consignatario</p><p className="font-semibold">{shipment.consignee.fullName}</p><p className="text-xs text-slate-500">{shipment.consignee.ciNit}</p></div>
            <div><p className="text-xs text-slate-500 md:hidden">Remitente</p><p>{shipment.sender.fullName}</p></div>
            <div><span className={`border px-2 py-1 text-xs font-bold ${unpaid ? 'border-red-500 text-red-300' : 'border-[#d4d4d8] text-[#d4d4d8]'}`}>{unpaid ? `POR PAGAR Bs ${Number(shipment.totalAmount).toFixed(2)}` : 'PAGADO'}</span></div>
            <button onClick={() => setSelected(shipment)} className="border border-white bg-white px-3 py-2 text-xs font-bold uppercase text-black hover:bg-[#d4d4d8]">Entregar →</button>
          </div>;
        })}
      </div>
      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between text-xs uppercase text-slate-400">
          <span>{skip + 1}–{Math.min(skip + PAGE, total)} de {total}</span>
          <div className="flex gap-2">
            <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))} className="border border-white/20 px-3 py-2 disabled:opacity-40">Anterior</button>
            <button disabled={skip + PAGE >= total} onClick={() => setSkip(skip + PAGE)} className="border border-white/20 px-3 py-2 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}
      <ConfirmModal isOpen={Boolean(selected)} guideNumber={selected?.guideNumber ?? ''} requiresPayment={selected?.paymentType === 'POR_PAGAR' && !selected.isPaid} onClose={() => setSelected(null)} onConfirm={deliver} />
    </div>
  );
}
