import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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

  const syncNow = useCallback(async () => {
    if (!userIdRef.current) return;
    setIsSyncing(true);
    try {
      await trySync(userIdRef.current);
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
