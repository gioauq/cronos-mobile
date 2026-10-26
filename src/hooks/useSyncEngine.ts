import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { trySync } from '../lib/sync';
import { getPendingCount } from '../db/database';

const SAFETY_INTERVAL_MS = 60_000;

export function useSyncEngine(userId: number | undefined) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refreshPendingCount = useCallback(async () => {
    if (!userIdRef.current) return;
    setPendingCount(await getPendingCount(userIdRef.current));
  }, []);

  /**
   * Nunca propaga erro: é chamada por listeners (NetInfo, AppState, intervalo) que não têm
   * catch, e agora também ANTES de gravar a batida — uma falha de rede aqui não pode impedir
   * ninguém de bater o ponto.
   */
  const syncNow = useCallback(async () => {
    if (!userIdRef.current) return;
    setIsSyncing(true);
    try {
      const outcome = await trySync(userIdRef.current);

      // Batida que estava na fila offline e voltou do servidor em quarentena: o servidor precisa
      // saber, senão ele vê "0 pendentes" e acredita que a hora entrou na folha. Quem bateu com o
      // app aberto já viu o alerta na hora — este cobre a que sincronizou sozinha depois.
      if (outcome.divergent > 0) {
        Alert.alert(
          outcome.divergent > 1 ? 'Marcações enviadas para análise' : 'Marcação enviada para análise',
          `${outcome.divergent} marcação(ões) foram aceitas com pendência (${outcome.divergenceReasons.join(' e ')}).`
            + ' Elas só entram na folha depois que o RH liberar.'
        );
      }
    } catch {
      // Sem rede, 422 ou servidor fora: as batidas continuam na fila local e a próxima
      // tentativa (NetInfo/AppState/intervalo) tenta de novo.
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setIsOnline(online);
      if (online) syncNow();
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNow();
    });

    const interval = setInterval(syncNow, SAFETY_INTERVAL_MS);

    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [syncNow, refreshPendingCount]);

  return { isOnline, pendingCount, isSyncing, syncNow, refreshPendingCount };
}
