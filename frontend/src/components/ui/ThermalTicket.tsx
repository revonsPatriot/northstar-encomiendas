import { QRCodeSVG } from 'qrcode.react';
import type { Shipment } from '../../../../shared/types/shipment.types';
import { numberToLiteral } from '../../lib/number-to-literal';

export default function ThermalTicket({ shipment }: { shipment: Shipment }) {
  const amount = Number(shipment.totalAmount);
  return (
    <article id="thermal-ticket" className="mx-auto mt-8 w-[302px] bg-white p-4 text-center text-xs text-black shadow print:shadow-none">
      <p className="text-lg font-black tracking-[0.18em]">NORTHSTAR</p>
      <p className="mt-1">TRANSPORTADORA DE ENCOMIENDAS</p>
      <div className="my-3 border-y border-dashed border-black py-3">
        <p className="text-[11px]">N° DE GUÍA</p>
        <p className="text-3xl font-black tracking-widest">{shipment.guideNumber}</p>
      </div>
      <div className="flex justify-center">
        <QRCodeSVG value={`${window.location.origin}/?guia=${shipment.guideNumber}`} size={110} />
      </div>
      <div className="mt-3 text-left">
        <p><strong>Remitente:</strong> {shipment.sender.fullName}</p>
        <p><strong>Consignatario:</strong> {shipment.consignee.fullName}</p>
        <p><strong>Modalidad:</strong> {shipment.paymentType.replaceAll('_', ' ')}</p>
        <p><strong>Total:</strong> Bs {amount.toFixed(2)}</p>
        <p className="mt-2 text-[10px] uppercase">{numberToLiteral(amount)}</p>
      </div>
      <p className="mt-4 border-t border-dashed border-black pt-3">Conserve este comprobante para rastrear su encomienda.</p>
      <style>{`@media print { body * { visibility: hidden; } #thermal-ticket, #thermal-ticket * { visibility: visible; } #thermal-ticket { position: absolute; left: 0; top: 0; } }`}</style>
    </article>
  );
}