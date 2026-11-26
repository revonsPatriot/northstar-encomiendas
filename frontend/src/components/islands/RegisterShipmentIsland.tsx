import { useEffect, useMemo, useState } from 'react';
import type { Branch, Customer, PaymentType, Route, Shipment } from '../../../../shared/types/shipment.types';
import { getSessionUser, isNetworkError } from '../../services/api-client';
import { countQueuedShipments, enqueueShipment, newRequestId, syncQueuedShipments } from '../../lib/offline-queue';
import { listBranches, listRoutes, registerShipment, searchCustomers } from '../../services/shipment.service';
import ThermalTicket from '../ui/ThermalTicket';

interface ItemForm {
  quantity: number;
  description: string;
  weightKg: number;
  subtotal: number;
}

const emptyItem = (): ItemForm => ({ quantity: 1, description: '', weightKg: 0, subtotal: 0 });

export default function RegisterShipmentIsland() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [sender, setSender] = useState<Customer>({ fullName: '', ciNit: '', phone: '' });
  const [consignee, setConsignee] = useState<Customer>({ fullName: '', ciNit: '', phone: '' });
  const [senderResults, setSenderResults] = useState<Customer[]>([]);
  const [consigneeResults, setConsigneeResults] = useState<Customer[]>([]);
  const [destinationBranchId, setDestinationBranchId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('PAGADO_ORIGEN');
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const user = getSessionUser<{ branchId: string }>();

  const [requestId, setRequestId] = useState(() => newRequestId());
  const [pending, setPending] = useState(0);

  async function runSync() {
    const result = await syncQueuedShipments();
    setPending(result.pending);
    if (result.synced > 0) setMessage(`${result.synced} envío(s) pendiente(s) sincronizado(s).`);
    if (result.failed > 0) setMessage(`${result.failed} envío(s) en cola fueron rechazados por el servidor. Revísalos con el administrador.`);
  }

  useEffect(() => {
    void countQueuedShipments().then(setPending);
    void runSync();
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, []);

  useEffect(() => {
    listBranches().then(setBranches).catch((error) => setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las sucursales.'));
    listRoutes().then(setRoutes).catch(() => undefined);
  }, []);

  const activeRoute = useMemo(
    () => routes.find((r) => r.originBranchId === user?.branchId && r.destinationBranchId === destinationBranchId),
    [routes, user?.branchId, destinationBranchId],
  );

  function applyRouteTariff() {
    if (!activeRoute) return;
    const totalKg = items.reduce((sum, item) => sum + Number(item.weightKg || 0), 0);
    const suggested = Math.round((Number(activeRoute.basePrice) + totalKg * Number(activeRoute.pricePerKg)) * 100) / 100;
    updateItem(0, { subtotal: suggested });
  }

  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0), [items]);

  function updateItem(index: number, patch: Partial<ItemForm>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function search(query: string, type: 'sender' | 'consignee') {
    if (query.trim().length < 2) {
      type === 'sender' ? setSenderResults([]) : setConsigneeResults([]);
      return;
    }
    try {
      const results = await searchCustomers(query);
      type === 'sender' ? setSenderResults(results) : setConsigneeResults(results);
    } catch {
      // Sin conexión: se continúa registrando manualmente.
    }
  }

  function selectCustomer(customer: Customer, type: 'sender' | 'consignee') {
    type === 'sender' ? setSender(customer) : setConsignee(customer);
    type === 'sender' ? setSenderResults([]) : setConsigneeResults([]);
  }

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!user?.branchId) {
      setMessage('Sesión no encontrada. Vuelve a iniciar sesión.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const request = {
        originBranchId: user.branchId,
        destinationBranchId,
        sender,
        consignee,
        paymentType,
        totalAmount: Math.round(total * 100) / 100,
        items: items.map((item) => ({ ...item, weightKg: item.weightKg || undefined })),
        clientRequestId: requestId,
      };
      try {
        const created = await registerShipment(request);
        setShipment(created);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        await enqueueShipment(request);
        setShipment(null);
        setPending(await countQueuedShipments());
        setMessage('Sin conexión: el envío se guardó en este equipo y se enviará automáticamente al volver internet.');
      }
      setRequestId(newRequestId());
      setItems([emptyItem()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo registrar la encomienda.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up grid gap-8 xl:grid-cols-[minmax(0,1fr)_350px]">
      <form onSubmit={submit} className="space-y-6">
        {pending > 0 && <p className="border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">{pending} envío(s) guardado(s) sin conexión, pendientes de sincronizar.</p>}
        <section className="border border-white/10 bg-[#0b0e14] p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-black uppercase">Ruta y modalidad</h2><span className="text-xs uppercase tracking-wider text-slate-500">Origen automático</span></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Destino
              <select required value={destinationBranchId} onChange={(event) => setDestinationBranchId(event.target.value)} className="mt-2 w-full border border-white/15 bg-[#07090d] px-3 py-3 text-white outline-none focus:border-[#d4d4d8]">
                <option value="">Selecciona una sucursal</option>
                {branches.filter((branch) => branch.id !== user?.branchId).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Modalidad de cobro
              <select value={paymentType} onChange={(event) => setPaymentType(event.target.value as PaymentType)} className="mt-2 w-full border border-white/15 bg-[#07090d] px-3 py-3 text-white outline-none focus:border-[#d4d4d8]">
                <option value="PAGADO_ORIGEN">Pagado en origen</option>
                <option value="POR_PAGAR">Por pagar en destino</option>
                <option value="CUENTA_CORPORATIVA">Cuenta corporativa</option>
              </select>
            </label>
          </div>
          {activeRoute && (
            <div className="animate-fade-in mt-4 flex flex-wrap items-center justify-between gap-3 border border-white/15 bg-[#07090d] px-4 py-3 text-xs">
              <span className="text-slate-300">
                Ruta configurada: <strong>Base Bs {Number(activeRoute.basePrice).toFixed(2)}</strong> + Bs {Number(activeRoute.pricePerKg).toFixed(2)}/kg
                {activeRoute.estimatedHours ? ` · ~${activeRoute.estimatedHours} h` : ''}
              </span>
              <button type="button" onClick={applyRouteTariff} className="btn-tactile border border-white/30 px-3 py-1.5 font-bold uppercase text-white hover:border-white">
                Aplicar tarifa sugerida
              </button>
            </div>
          )}
        </section>
        <section className="border border-white/10 bg-[#0b0e14] p-6">
          <h2 className="text-xl font-black uppercase">Personas</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {([
              ['Remitente', sender, setSender, senderResults, 'sender'],
              ['Consignatario', consignee, setConsignee, consigneeResults, 'consignee'],
            ] as const).map(([label, customer, setCustomer, results, type]) => (
              <div key={type} className="relative border border-white/10 p-4">
                <p className="font-bold uppercase">{label}</p>
                <input required placeholder="Nombre completo" value={customer.fullName} onChange={(event) => { setCustomer({ ...customer, fullName: event.target.value }); void search(event.target.value, type); }} className="mt-3 w-full border border-white/15 bg-[#07090d] px-3 py-2 outline-none focus:border-[#d4d4d8]" />
                <input placeholder="C.I. / NIT" value={customer.ciNit ?? ''} onChange={(event) => { setCustomer({ ...customer, ciNit: event.target.value }); void search(event.target.value, type); }} className="mt-2 w-full border border-white/15 bg-[#07090d] px-3 py-2 outline-none focus:border-[#d4d4d8]" />
                <input placeholder="Teléfono" value={customer.phone ?? ''} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} className="mt-2 w-full border border-white/15 bg-[#07090d] px-3 py-2 outline-none focus:border-[#d4d4d8]" />
                {results.length > 0 && <div className="absolute left-4 right-4 top-full z-10 border border-white/15 bg-[#0b0e14] p-2 shadow-lg">{results.map((result) => <button type="button" key={result.id} onClick={() => selectCustomer(result, type)} className="block w-full px-2 py-2 text-left text-sm hover:bg-white/10">{result.fullName} · {result.ciNit ?? result.phone}</button>)}</div>}
              </div>
            ))}
          </div>
        </section>
        <section className="border border-white/10 bg-[#0b0e14] p-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-black uppercase">Ítems</h2><button type="button" onClick={() => setItems([...items, emptyItem()])} className="border border-white/20 px-3 py-2 text-xs font-bold uppercase hover:border-[#d4d4d8]">+ Añadir fila</button></div>
          <div className="mt-5 space-y-3">
            {items.map((item, index) => <div key={index} className="grid gap-2 md:grid-cols-[80px_1fr_110px_130px_32px]">
              <input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className="border border-white/15 bg-[#07090d] px-3 py-2" aria-label="Cantidad" />
              <input required placeholder="Concepto" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} className="border border-white/15 bg-[#07090d] px-3 py-2" />
              <input type="number" min="0" step="0.01" value={item.weightKg} onChange={(event) => updateItem(index, { weightKg: Number(event.target.value) })} className="border border-white/15 bg-[#07090d] px-3 py-2" aria-label="Peso en kg" />
              <input required type="number" min="0" step="0.01" value={item.subtotal} onChange={(event) => updateItem(index, { subtotal: Number(event.target.value) })} className="border border-white/15 bg-[#07090d] px-3 py-2" aria-label="Monto" />
              <button type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1} className="text-slate-400 hover:text-red-400 disabled:opacity-30">×</button>
            </div>)}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5"><span className="eyebrow">Total a cobrar</span><strong className="text-2xl text-[#d4d4d8]">Bs {total.toFixed(2)}</strong></div>
        </section>
        {message && <p className="border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">{message}</p>}
        <button disabled={saving} className="w-full border border-white bg-white px-5 py-4 text-xs font-black uppercase tracking-[0.14em] text-black hover:bg-[#d4d4d8] disabled:opacity-50">{saving ? 'Registrando...' : 'Registrar encomienda →'}</button>
      </form>
      <aside>{shipment ? <><div className="flex items-center justify-between"><h2 className="font-bold uppercase">Comprobante</h2><button onClick={() => window.print()} className="border border-white bg-white px-3 py-2 text-xs font-bold uppercase text-black hover:bg-[#d4d4d8]">Imprimir</button></div><ThermalTicket shipment={shipment} /></> : <div className="border border-dashed border-white/20 p-8 text-center text-slate-500">El ticket aparecerá aquí después de registrar la guía.</div>}</aside>
    </div>
  );
}