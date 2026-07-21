export type WorkUnit = {
  id: number;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address: string | null;
};

/**
 * Formato canônico do usuário autenticado no app, já normalizado (camelCase)
 * a partir da resposta da API — ponto único de verdade em vez de shapes
 * repetidos independentemente em auth.ts, user.ts e AuthContext.tsx.
 */
export type AppUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  requiresSelfie: boolean;
  requiresLocation: boolean;
  workUnit: WorkUnit | null;
};
