import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type Coordinates = { latitude: number; longitude: number } | null;

/** Fix já obtido pelo aquecimento da tela (useLocationWarmup), com a hora em que chegou. */
export type WarmFix = {
  coords: { latitude: number; longitude: number };
  accuracy: number | null;
  at: number;
};

/**
 * Por que a localização não veio. São três coisas DIFERENTES e cada uma tem uma saída
 * diferente para o usuário — tratá-las como uma só ("ative o GPS") era o motivo de a pessoa
 * ficar presa sem conseguir bater o ponto:
 * - permission_denied: só os ajustes do sistema resolvem.
 * - services_disabled: a localização do aparelho está desligada.
 * - no_fix: tudo ligado e permitido, mas nenhum satélite/antena respondeu no tempo. Não é
 *   culpa de quem bate o ponto — é aqui que a batida vai para quarentena.
 */
export type LocationFailure = 'permission_denied' | 'services_disabled' | 'no_fix';

export type LocationSource = 'warm' | 'last_known' | 'fresh' | 'stale';

export type LocationResult =
  | {
      ok: true;
      coords: { latitude: number; longitude: number };
      source: LocationSource;
    }
  | { ok: false; failure: LocationFailure };

/** Degraus da escada, só pra mostrar o que está acontecendo na tela. */
export type LocationStage = 'permission' | 'last_known' | 'services' | 'fresh';

/** Fix aquecido com menos que isto é usado direto, sem esperar nada. */
export const WARM_FIX_MAX_AGE_MS = 60_000;

/** Último fix do sistema: 2 min e 200 m de raio são de sobra para um geofence de centenas de metros. */
const LAST_KNOWN_MAX_AGE_MS = 120_000;
const LAST_KNOWN_REQUIRED_ACCURACY_M = 200;

/** Teto da tentativa ao vivo. 20s porque fix frio dentro de prédio passa fácil dos 5s de antes. */
const FRESH_FIX_TIMEOUT_MS = 20_000;

/**
 * Raio de erro com que o fix ao vivo já é bom o bastante pra parar de esperar. Acima disso a
 * subscrição continua aberta e vai refinando até o teto de tempo — um fix com 2 km de erro
 * (típico de permissão "localização aproximada" no Android) cai fora do raio da unidade e
 * manda pra quarentena uma batida que estava no lugar certo.
 */
const ACCEPTABLE_ACCURACY_M = 200;

/** Último recurso depois do timeout: o sistema pode ter cacheado um fix durante a espera. */
const STALE_MAX_AGE_MS = 600_000;

export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Escada de localização: cada degrau é barato e limitado no tempo, e só desce para o próximo
 * se o anterior não entregar nada.
 *
 * 1. fix aquecido pela tela, se tiver menos de 1 min (instantâneo)
 * 2. permissão (só pede se ainda dá pra pedir)
 * 3. último fix conhecido do sistema: 2 min, 200 m (instantâneo)
 * 4. localização do aparelho desligada → diálogo do sistema pra ligar (Android)
 * 5. fix ao vivo, Accuracy.Balanced, teto de 20s
 * 6. último fix conhecido de novo, aceitando até 10 min — o GPS acordou na tentativa acima
 *
 * Accuracy.Balanced (100 m) em vez de High (10 m) de propósito: resolve por wifi/antena em
 * 1–3s onde High fica esperando satélite, e o raio do geofence é de centenas de metros.
 */
export async function acquireCoordinates(options?: {
  warmFix?: WarmFix | null;
  onStage?: (stage: LocationStage) => void;
}): Promise<LocationResult> {
  const warmFix = options?.warmFix ?? null;
  const onStage = options?.onStage ?? (() => {});

  if (warmFix && Date.now() - warmFix.at <= WARM_FIX_MAX_AGE_MS) {
    return { ok: true, coords: warmFix.coords, source: 'warm' };
  }

  onStage('permission');
  if (!(await ensurePermission())) {
    return { ok: false, failure: 'permission_denied' };
  }

  onStage('last_known');
  const lastKnown = await lastKnownCoordinates(LAST_KNOWN_MAX_AGE_MS, LAST_KNOWN_REQUIRED_ACCURACY_M);
  if (lastKnown) {
    return { ok: true, coords: lastKnown, source: 'last_known' };
  }

  onStage('services');
  if (!(await ensureServicesEnabled())) {
    return { ok: false, failure: 'services_disabled' };
  }

  onStage('fresh');
  const fresh = await freshCoordinates(FRESH_FIX_TIMEOUT_MS);
  if (fresh) {
    return { ok: true, coords: fresh, source: 'fresh' };
  }

  // A tentativa ao vivo acordou o GPS; mesmo tendo estourado o teto, o sistema pode ter
  // guardado um fix no caminho. Um fix de minutos atrás vale mais que nenhum.
  const stale = await lastKnownCoordinates(STALE_MAX_AGE_MS, null);
  if (stale) {
    return { ok: true, coords: stale, source: 'stale' };
  }

  return { ok: false, failure: 'no_fix' };
}

async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') return true;

    // canAskAgain falso = o usuário já negou de forma definitiva; pedir de novo não abre nada.
    if (!current.canAskAgain) return false;

    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.status === 'granted';
  } catch {
    return false;
  }
}

async function ensureServicesEnabled(): Promise<boolean> {
  try {
    if (await Location.hasServicesEnabledAsync()) return true;

    // Android: abre o diálogo do próprio sistema pra ligar a localização sem sair do app
    // (rejeita a promise se o usuário recusar). No iOS não existe equivalente — só os ajustes.
    if (Platform.OS === 'android') {
      await Location.enableNetworkProviderAsync();
      return Location.hasServicesEnabledAsync();
    }

    return false;
  } catch {
    return false;
  }
}

async function lastKnownCoordinates(maxAge: number, requiredAccuracy: number | null): Promise<Coordinates> {
  try {
    const last = await Location.getLastKnownPositionAsync(
      requiredAccuracy === null ? { maxAge } : { maxAge, requiredAccuracy }
    );

    if (!last) return null;

    return { latitude: last.coords.latitude, longitude: last.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Fix ao vivo com teto de tempo DE VERDADE: usa watchPositionAsync e descarta a subscrição no
 * timeout. O Promise.race com getCurrentPositionAsync que existia antes não cancelava nada —
 * a chamada de GPS seguia pendurada depois de o timer ganhar a corrida.
 *
 * Devolve o MELHOR fix da janela, não o primeiro: a subscrição vai refinando, então esperar
 * um pouco mais por precisão é melhor que gravar o primeiro palpite grosseiro.
 */
async function freshCoordinates(timeoutMs: number): Promise<Coordinates> {
  let subscription: Location.LocationSubscription | null = null;

  return new Promise<Coordinates>((resolve) => {
    let settled = false;
    let best: { coords: { latitude: number; longitude: number }; accuracy: number } | null = null;

    const finish = (coords: Coordinates) => {
      if (settled) return;
      settled = true;
      subscription?.remove();
      subscription = null;
      resolve(coords);
    };

    const timer = setTimeout(() => finish(best?.coords ?? null), timeoutMs);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: true },
      (location) => {
        const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        // accuracy nulo = aparelho não informou o raio de erro; trata como aceitável, senão
        // esperaríamos os 20s inteiros de graça nesses aparelhos.
        const accuracy = location.coords.accuracy ?? 0;

        if (accuracy <= ACCEPTABLE_ACCURACY_M) {
          clearTimeout(timer);
          finish(coords);
          return;
        }

        if (!best || accuracy < best.accuracy) {
          best = { coords, accuracy };
        }
      },
      () => {
        clearTimeout(timer);
        finish(best?.coords ?? null);
      }
    )
      .then((sub) => {
        if (settled) {
          sub.remove();
          return;
        }
        subscription = sub;
      })
      .catch(() => {
        clearTimeout(timer);
        finish(null);
      });
  });
}

export async function reverseGeocode(coords: {
  latitude: number;
  longitude: number;
}): Promise<string | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync(coords);
    if (!address) return null;
    const parts = [address.street, address.streetNumber].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : (address.name ?? null);
  } catch {
    return null;
  }
}
