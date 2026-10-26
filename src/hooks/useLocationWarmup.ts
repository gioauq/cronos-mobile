import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { hasLocationPermission, WarmFix } from '../lib/location';

/**
 * Mantém o GPS aquecido enquanto a tela de bater ponto está aberta, para que a batida não
 * precise acordar o GPS do zero no momento do toque — era isso que fazia a pessoa esperar
 * (e desistir) na hora de bater.
 *
 * Nunca PEDE a permissão: se ela ainda não foi concedida, o aquecimento fica quieto e quem
 * pede é a escada no momento da batida (acquireCoordinates). Depois que o usuário concede,
 * a tela chama recheck() e o aquecimento começa.
 *
 * A subscrição morre ao sair da tela e quando o app vai pro fundo — watchPositionAsync só
 * entrega no primeiro plano mesmo, e deixá-la viva à toa gasta bateria.
 */
export function useLocationWarmup(enabled: boolean) {
  const warmFixRef = useRef<WarmFix | null>(null);
  const [warmFix, setWarmFix] = useState<WarmFix | null>(null);
  const [permissionTick, setPermissionTick] = useState(0);

  const recheck = useCallback(() => setPermissionTick((tick) => tick + 1), []);

  const store = useCallback((location: Location.LocationObject) => {
    const fix: WarmFix = {
      coords: { latitude: location.coords.latitude, longitude: location.coords.longitude },
      accuracy: location.coords.accuracy ?? null,
      at: Date.now(),
    };
    warmFixRef.current = fix;
    setWarmFix(fix);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    const start = async () => {
      if (cancelled || subscription) return;
      if (!(await hasLocationPermission())) return;

      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
        if (last && !cancelled) store(last);
      } catch {
        // Sem fix em cache — o watch abaixo resolve.
      }

      if (cancelled) return;

      try {
        const sub = await Location.watchPositionAsync(
          // Balanced + 15s/25m: preciso o bastante pro geofence e leve o bastante pra deixar
          // ligado enquanto a tela está aberta.
          { accuracy: Location.Accuracy.Balanced, timeInterval: 15_000, distanceInterval: 25 },
          store,
          () => {}
        );

        if (cancelled) {
          sub.remove();
          return;
        }

        subscription = sub;
      } catch {
        // Localização desligada no aparelho: a escada avisa o usuário na hora da batida.
      }
    };

    const stop = () => {
      subscription?.remove();
      subscription = null;
    };

    start();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });

    return () => {
      cancelled = true;
      stop();
      appStateSubscription.remove();
    };
  }, [enabled, permissionTick, store]);

  return { warmFix, warmFixRef, recheck };
}
