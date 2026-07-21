import { api } from './client';
import { AppUser, WorkUnit } from '../types/user';

export type { WorkUnit } from '../types/user';

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  requires_selfie: boolean;
  requires_location: boolean;
  work_unit: (Omit<WorkUnit, 'latitude' | 'longitude'> & { latitude: string; longitude: string }) | null;
};

export type FetchedUser = AppUser;

export async function fetchCurrentUser(): Promise<FetchedUser> {
  const response = await api.get<CurrentUser>('/user');
  const raw = response.data;

  const workUnit: WorkUnit | null = raw.work_unit
    ? {
        id: raw.work_unit.id,
        name: raw.work_unit.name,
        type: raw.work_unit.type,
        latitude: parseFloat(raw.work_unit.latitude),
        longitude: parseFloat(raw.work_unit.longitude),
        radius_meters: raw.work_unit.radius_meters,
        address: raw.work_unit.address,
      }
    : null;

  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    requiresSelfie: raw.requires_selfie,
    requiresLocation: raw.requires_location,
    workUnit,
  };
}
