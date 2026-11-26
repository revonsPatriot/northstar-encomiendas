import type {
  AccountActivity,
  AccountProfile,
} from '../../../shared/types/shipment.types';
import { apiFetch } from './api-client';

export const getAccountProfile = () => apiFetch<AccountProfile>('/auth/me');

export const getAccountActivity = () =>
  apiFetch<AccountActivity>('/auth/me/activity');

export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch<{ ok: boolean }>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
