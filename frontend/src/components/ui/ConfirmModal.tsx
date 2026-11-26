import { useState } from 'react';

interface ConfirmModalProps {
  guideNumber: string;
  isOpen: boolean;
  requiresPayment: boolean;
  onClose: () => void;
  onConfirm: (receiverCi: string, payOnDelivery: boolean, notes: string) => Promise<void>;
}

export default function ConfirmModal({
  guideNumber,
  isOpen,
  requiresPayment,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const [receiverCi, setReceiverCi] = useState('');
  const [notes, setNotes] = useState('');
  const [payOnDelivery, setPayOnDelivery] = useState(requiresPayment);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    setSaving(true);
    try {
      await onConfirm(receiverCi, payOnDelivery, notes);
      setReceiverCi('');
      setNotes('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <form onSubmit={submit} className="w-full max-w-md border border-white/15 bg-[#0b0e14] p-6 shadow-2xl">
        <p className="eyebrow">Confirmar entrega</p>
        <h2 className="mt-3 text-2xl font-black uppercase">Guía {guideNumber}</h2>
        <label className="mt-6 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">C.I. de quien recoge
          <input required value={receiverCi} onChange={(event) => setReceiverCi(event.target.value)} className="mt-2 w-full border border-white/15 bg-[#07090d] px-3 py-3 outline-none focus:border-[#d4d4d8]" />
        </label>
        {requiresPayment && (
          <label className="mt-4 flex items-center gap-3 border border-red-500/30 bg-red-950/30 p-3 text-sm font-semibold text-red-300">
            <input type="checkbox" checked={payOnDelivery} onChange={(event) => setPayOnDelivery(event.target.checked)} />
            Confirmar cobro de {requiresPayment ? 'la encomienda POR PAGAR' : ''}
          </label>
        )}
        <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Notas (opcional)
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full border border-white/15 bg-[#07090d] px-3 py-2 outline-none focus:border-[#d4d4d8]" />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 font-semibold text-slate-400 hover:text-white">Cancelar</button>
          <button disabled={saving} className="border border-white bg-white px-4 py-2 text-xs font-black uppercase text-black disabled:opacity-50">{saving ? 'Guardando...' : 'Confirmar →'}</button>
        </div>
      </form>
    </div>
  );
}