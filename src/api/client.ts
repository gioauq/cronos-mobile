import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Builds de loja recebem EXPO_PUBLIC_API_URL pelo eas.json (produção). Em desenvolvimento,
// cai no IP local da máquina rodando o backend Laravel (não use 127.0.0.1 — o
// celular/emulador não resolve isso para o host).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.100.20/Cronos/public/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
  },
});

export async function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    await SecureStore.setItemAsync('auth_token', token);
  } else {
    delete api.defaults.headers.common.Authorization;
    await SecureStore.deleteItemAsync('auth_token');
  }
}

export async function loadStoredToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
  return token;
}

export async function pingServer(): Promise<boolean> {
  try {
    const response = await api.get('/ping', { timeout: 5000 });
    return response.data?.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Chamado pelo AuthContext para limpar a sessão local quando o servidor
 * responde 401 (token expirado/revogado) — sem isso, toda tela tratava sessão
 * expirada como "sem internet" e o usuário ficava preso vendo erro de rede.
 */
let onSessionExpired: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      onSessionExpired?.();
    }
    return Promise.reject(error);
  }
);
