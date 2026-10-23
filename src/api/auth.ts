import { api } from './client';
import { AppUser } from '../types/user';

export type AuthUser = Pick<AppUser, 'id' | 'name' | 'email' | 'role'>;

// Duplo vínculo: a mesma pessoa (mesmo CPF) pode ter duas matrículas, cada uma com escala e
// unidade próprias. Nesse caso o backend responde a lista de vínculos SEM token, e o app
// repete o login informando o registration_number escolhido.
export type Bond = {
  registration_number: string;
  work_unit: string | null;
  job_title: string | null;
};

export type LoginSuccess = {
  token: string;
  user: AuthUser;
};

export type LoginResponse = LoginSuccess | { requires_bond_selection: true; bonds: Bond[] };

export function requiresBondSelection(
  response: LoginResponse
): response is { requires_bond_selection: true; bonds: Bond[] } {
  return 'requires_bond_selection' in response && response.requires_bond_selection === true;
}

export async function login(
  cpf: string,
  password: string,
  deviceName: string,
  registrationNumber?: string
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/login', {
    cpf,
    password,
    device_name: deviceName,
    ...(registrationNumber ? { registration_number: registrationNumber } : {}),
  });
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post('/logout');
}
