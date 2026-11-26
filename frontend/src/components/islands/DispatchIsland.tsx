import { useCallback, useEffect, useState } from 'react';
import type { Shipment, ShipmentStatus } from '../../../../shared/types/shipment.types';
import { getSessionUser } from '../../services/api-client';
import {
  arriveShipment,
  cancelShipment,
  dispatchShipment,
  listIncomingShipments,
  listOutgoingShipments,
} from '../../services/shipment.service';

const labels: Record<ShipmentStatus, string> = {
  REGISTRADO: 'Registrado',
  EN_TRANSITO: 'En tránsito',
  EN_SUCURSAL_DESTINO: 'En destino',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
};

type Tab = 'despachar' | 'recibir' | 'historial';

export default function DispatchIsland() {
  const user = getSessionUser<{ branchId: string; role: string }>();
  const canCancel = user?.role === 'ADMIN_CENTRAL' || user?.role === 'ENCARGADO_SUCURSAL';
  const [tab, setTab] = useState<Tab>('despachar');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Shipment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!user?.branchId) return;
    try {
      const page =
        tab === 'recibir'
          ? await listIncomingShipments(user.branchId, query)
          : await listOutgoingShipments(user.branchId, {
              query,
              status: tab === 'despachar' ? 'REGISTRADO' : undefined,
            });
      setItems(page.items);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar la lista.');
    }
  }, [tab, query, user?.branchId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function run(guide: string, action: () => Promise<unknown>, success: string) {
    setBusy(guide);
    setNotice('');
    try {
      await action();
      setNotice(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(null);
    }
  }

  function cancel(shipment: Shipment) {
    const reason = window.prompt(`Motivo de anulación de la guía ${shipment.guideNumber}:`);
    if (!reason || reason.trim().length < 5) return;
    void run(shipment.guideNumber, () => cancelShipment(shipment.guideNumber, reason.trim()), `Guía ${shipment.guideNumber} anulada.`);
  }

  const tabs: Array<[Tab, string]> = [['despachar', 'Por despachar'], ['recibir', 'Por recibir'], ['historial', 'Historial de envíos']];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`border px-4 py-2 text-xs font-bold uppercase ${tab === id ? 'border-white bg-white text-black' : 'border-white/20 text-slate-300 hover:border-white'}`}>{label}</button>
        ))}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar guía, nombre o C.I." aria-label="Buscar" className="ml-auto w-64 border border-white/15 bg-[#07090d] px-3 py-2 text-sm outline-none focus:border-[#d4d4d8]" />
      </div>
      {message && <p role="alert" className="mt-4 border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">{message}</p>}
      {notice && <p role="status" className="mt-4 border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-300">{notice}</p>}
      <div className="mt-4 overflow-hidden border border-white/10 bg-[#0b0e14]">
        {items.length === 0 ? <p className="p-10 text-center text-slate-500">No hay encomiendas en esta vista.</p> : items.map((shipment) => (
          <div key={shipment.id} className="grid gap-3 border-b border-white/10 px-5 py-4 md:grid-cols-[110px_1fr_1fr_130px_auto] md:items-center">
            <strong className="text-lg">{shipment.guideNumber}</strong>
            <div><p className="font-semibold">{shipment.consignee.fullName}</p><p className="text-xs text-slate-500">{shipment.originBranch?.name} → {shipment.destinationBranch?.name}</p></div>
            <p className="text-sm text-slate-400">{shipment.items.map((item) => `${item.quantity}× ${item.description}`).join(', ')}</p>
            <span className="w-fit border border-white/30 px-2 py-1 text-xs font-bold uppercase">{labels[shipment.status]}</span>
            <div className="flex gap-2">
              {tab === 'despachar' && <button disabled={busy === shipment.guideNumber} onClick={() => void run(shipment.guideNumber, () => dispatchShipment(shipment.guideNumber), `Guía ${shipment.guideNumber} despachada.`)} className="border border-white bg-white px-3 py-2 text-xs font-bold uppercase text-black disabled:opacity-50">Despachar</button>}
              {tab === 'recibir' && <button disabled={busy === shipment.guideNumber} onClick={() => void run(shipment.guideNumber, () => arriveShipment(shipment.guideNumber), `Guía ${shipment.guideNumber} recibida en sucursal.`)} className="border border-white bg-white px-3 py-2 text-xs font-bold uppercase text-black disabled:opacity-50">Confirmar llegada</button>}
              {canCancel && (shipment.status === 'REGISTRADO' || shipment.status === 'EN_TRANSITO') && tab !== 'recibir' && <button disabled={busy === shipment.guideNumber} onClick={() => cancel(shipment)} className="border border-red-500/60 px-3 py-2 text-xs font-bold uppercase text-red-300 disabled:opacity-50">Anular</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
