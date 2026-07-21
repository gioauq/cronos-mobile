import { api } from './client';
import { AppUser } from '../types/user';

export type AuthUser = Pick<AppUser, 'id' | 'name' | 'email' | 'role'>;

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export async function login(email: string, password: string, deviceName: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/login', {
    email,
    password,
    device_name: deviceName,
  });
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post('/logout');
}
