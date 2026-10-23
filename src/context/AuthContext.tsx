import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { loadStoredToken, registerSessionExpiredHandler, setAuthToken } from '../api/client';
import { Bond, login as apiLogin, logout as apiLogout, requiresBondSelection } from '../api/auth';
import { fetchCurrentUser, FetchedUser } from '../api/user';
import { initDatabase } from '../db/database';
import { registerForPushNotifications, unregisterPushNotifications } from '../lib/push';
import { AppUser } from '../types/user';

type SessionUser = AppUser;

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  // Devolve a lista de vínculos quando o CPF tem mais de uma matrícula (duplo vínculo) — a
  // tela de login mostra a escolha e repete o signIn com o registrationNumber. Devolve null
  // quando o login concluiu de verdade.
  signIn: (cpf: string, password: string, registrationNumber?: string) => Promise<Bond[] | null>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toSessionUser(fresh: FetchedUser): SessionUser {
  return {
    id: fresh.id,
    name: fresh.name,
    email: fresh.email,
    role: fresh.role,
    requiresSelfie: fresh.requiresSelfie,
    requiresLocation: fresh.requiresLocation,
    workUnit: fresh.workUnit,
    registrationNumber: fresh.registrationNumber,
    department: fresh.department,
    admissionDate: fresh.admissionDate,
    hasPhoto: fresh.hasPhoto,
  };
}

async function persistUser(user: SessionUser) {
  await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await initDatabase();
      const token = await loadStoredToken();
      const storedUserJson = await SecureStore.getItemAsync('auth_user');
      if (token && storedUserJson) {
        setUser(JSON.parse(storedUserJson));
      }
      setIsLoading(false);

      // Atualiza a unidade e as configurações de coleta em segundo plano (não bloqueia o app se estiver offline).
      if (token && storedUserJson) {
        fetchCurrentUser()
          .then(async (fresh) => {
            const updated = toSessionUser(fresh);
            await persistUser(updated);
            setUser(updated);
          })
          .catch(() => {});

        registerForPushNotifications();
      }
    })();
  }, []);

  const signIn = useCallback(async (cpf: string, password: string, registrationNumber?: string) => {
    const deviceName = Device.deviceName ?? `${Device.modelName ?? 'Dispositivo'} (${Device.osName ?? 'mobile'})`;
    const response = await apiLogin(cpf, password, deviceName, registrationNumber);

    // Duplo vínculo: nada autenticado ainda (o backend não emitiu token) — devolve os
    // vínculos pra tela de login mostrar a escolha.
    if (requiresBondSelection(response)) {
      return response.bonds;
    }

    await setAuthToken(response.token);

    const fresh = await fetchCurrentUser();
    const sessionUser = toSessionUser(fresh);
    await persistUser(sessionUser);
    setUser(sessionUser);

    registerForPushNotifications();

    return null;
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await fetchCurrentUser();
    const sessionUser = toSessionUser(fresh);
    await persistUser(sessionUser);
    setUser(sessionUser);
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPushNotifications();
    try {
      await apiLogout();
    } catch {
      // Se o logout no servidor falhar (ex: sem conexão), ainda assim limpamos a sessão local.
    }
    await setAuthToken(null);
    await SecureStore.deleteItemAsync('auth_user');
    setUser(null);
  }, []);

  // Sessão expirada/revogada no servidor (401): limpa a sessão local sem tentar chamar
  // endpoints autenticados (o token já não vale nada) — antes disso, a tela ficava presa
  // mostrando "erro de conexão" para sempre em vez de voltar para o login.
  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setAuthToken(null);
      SecureStore.deleteItemAsync('auth_user');
      setUser(null);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, refreshUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
