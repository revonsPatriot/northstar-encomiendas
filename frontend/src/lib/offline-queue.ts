import Dexie, { type Table } from 'dexie';
import { isNetworkError } from '../services/api-client';
import {
  registerShipment,
  type RegisterShipmentRequest,
} from '../services/shipment.service';

export interface QueuedShipment {
  id?: number;
  payload: RegisterShipmentRequest;
  createdAt: string;
  lastError?: string;
}

class OfflineQueue extends Dexie {
  shipments!: Table<QueuedShipment, number>;

  constructor() {
    super('northstar-offline-queue');
    this.version(1).stores({ shipments: '++id, createdAt' });
  }
}

const queue = new OfflineQueue();

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function enqueueShipment(payload: RegisterShipmentRequest): Promise<number> {
  return queue.shipments.add({ payload, createdAt: new Date().toISOString() });
}

export function listQueuedShipments(): Promise<QueuedShipment[]> {
  return queue.shipments.orderBy('createdAt').toArray();
}

export function countQueuedShipments(): Promise<number> {
  return queue.shipments.count();
}

export function removeQueuedShipment(id: number): Promise<void> {
  return queue.shipments.delete(id);
}

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
}

let syncing = false;

/**
 * Envía en orden los registros guardados sin conexión. Cada uno lleva un
 * clientRequestId, por lo que reintentar nunca duplica guías.
 * Los errores de validación (4xx) quedan marcados para revisión manual.
 */
export async function syncQueuedShipments(): Promise<SyncResult> {
  if (syncing) return { synced: 0, failed: 0, pending: await countQueuedShipments() };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const items = await listQueuedShipments();
    for (const item of items) {
      try {
        await registerShipment(item.payload);
        await removeQueuedShipment(item.id!);
        synced += 1;
      } catch (error) {
        if (isNetworkError(error)) break;
        failed += 1;
        await queue.shipments.update(item.id!, {
          lastError: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed, pending: await countQueuedShipments() };
}
