import React, { useCallback, useEffect, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ArrowsClockwise } from 'phosphor-react-native';
import { colors, fontFamily, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { OfflineBanner } from '../components/OfflineBanner';
import { PunchButton } from '../components/PunchButton';
import { LocationCard } from '../components/LocationCard';
import { getCurrentCoordinates, reverseGeocode } from '../lib/location';
import { generatePunchHash } from '../lib/hash';
import { captureSelfie, deleteSelfie } from '../lib/selfie';
import { checkGeofence } from '../lib/geofence';
import { insertPunch, getRecentRecords, upsertFromServer, PunchType } from '../db/database';
import { nextPunchType, PUNCH_LABELS } from '../lib/punchFlow';
import { fetchTodayRecords } from '../api/timeRecords';

const TODAY_LABEL = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export function HomeScreen() {
  const { user } = useAuth();
  const { isOnline, pendingCount, syncNow } = useSyncEngine(user?.id);

  const [now, setNow] = useState(new Date());
  // A próxima batida é DERIVADA da última batida + a hora atual (que anda a cada segundo): assim o rótulo vira
  // "Saída" sozinho quando passa de 1h30 do almoço e volta a "Entrada" na virada do dia, sem precisar recarregar.
  const [lastPunch, setLastPunch] = useState<{ type: PunchType; recordedAt: string; beforeType: PunchType | null } | null>(null);
  const nextType = nextPunchType(lastPunch, now);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshNextType = useCallback(async () => {
    if (!user) return;
    const [last, before] = await getRecentRecords(user.id, 2);
    setLastPunch(last ? { type: last.type, recordedAt: last.recorded_at, beforeType: before?.type ?? null } : null);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const todayRecords = await fetchTodayRecords();
        for (const record of todayRecords) {
          await upsertFromServer({
            hash: record.hash ?? `server-${record.id}`,
            userId: user.id,
            recordedAt: record.recorded_at,
            type: record.type,
            latitude: record.latitude,
            longitude: record.longitude,
          });
        }
      } catch {
        // Sem conexão ou sem permissão — segue com o que já existe localmente.
      }
      await refreshNextType();
    })();
  }, [user, refreshNextType]);

  const savePunch = useCallback(
    async (selfieUri: string | null, coords: { latitude: number; longitude: number } | null) => {
      if (!user) return;
      const recordedAt = new Date().toISOString();
      const hash = await generatePunchHash(user.id, nextType, recordedAt);

      await insertPunch({
        hash,
        userId: user.id,
        recordedAt,
        type: nextType,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        selfieUri,
      });

      await refreshNextType();
      syncNow();
    },
    [user, nextType, refreshNextType, syncNow]
  );

  const handlePunch = async () => {
    if (!user) return;

    setIsSubmitting(true);
    // Fica true até o usuário decidir o alerta de fora-do-perímetro abaixo — sem essa
    // flag, o finally reseta isSubmitting assim que o Alert.alert (não-bloqueante) é
    // exibido, reabilitando o botão de bater ponto enquanto a decisão ainda está pendente.
    let deferResetToAlert = false;
    try {
      let selfieUri: string | null = null;
      if (user.requiresSelfie) {
        selfieUri = await captureSelfie();
        if (!selfieUri) {
          Alert.alert('Selfie obrigatória', 'A marcação de ponto exige uma selfie. Tente novamente.');
          return;
        }
      }

      let coords: { latitude: number; longitude: number } | null = null;
      if (user.requiresLocation) {
        setIsLocating(true);
        coords = await getCurrentCoordinates();
        setIsLocating(false);

        if (!coords) {
          deleteSelfie(selfieUri);
          Alert.alert('Localização obrigatória', 'Não foi possível obter sua localização. Ative o GPS e tente novamente.');
          return;
        }

        setCoordinates(coords);
        reverseGeocode(coords).then(setAddress);

        if (user.workUnit) {
          const { withinRadius, distanceMeters } = checkGeofence(coords, user.workUnit);

          if (!withinRadius) {
            deferResetToAlert = true;
            Alert.alert(
              'Fora do perímetro',
              `Você está a ${distanceMeters}m de ${user.workUnit.name} (raio permitido: ${user.workUnit.radius_meters}m). A marcação será salva, mas pode ser rejeitada na sincronização.`,
              [
                {
                  text: 'Cancelar',
                  style: 'cancel',
                  onPress: () => {
                    deleteSelfie(selfieUri);
                    setIsSubmitting(false);
                  },
                },
                {
                  text: 'Registrar mesmo assim',
                  onPress: async () => {
                    await savePunch(selfieUri, coords);
                    setIsSubmitting(false);
                  },
                },
              ]
            );
            return;
          }
        }
      }

      await savePunch(selfieUri, coords);
    } finally {
      if (!deferResetToAlert) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {!isOnline && <OfflineBanner />}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Cronos</Text>
          <Text style={styles.date}>{capitalize(TODAY_LABEL)}</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <ArrowsClockwise size={14} color={colors.secondary} weight="bold" />
            <Text style={styles.badgeLabel}>{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      <View style={styles.main}>
        <View style={styles.clock}>
          <Text style={styles.time}>{formatTime(now)}</Text>
          <Text style={styles.timeLabel}>Horário local</Text>
        </View>

        <View style={styles.punchArea}>
          <Text style={styles.nextLabel}>Próximo registro</Text>
          <PunchButton label={PUNCH_LABELS[nextType]} isSubmitting={isSubmitting} onPress={handlePunch} />
        </View>

        {user?.requiresLocation && <LocationCard isLoading={isLocating} address={address} coordinates={coordinates} />}
      </View>
    </SafeAreaView>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brand: {
    fontFamily: fontFamily.semiBold,
    fontSize: 20,
    color: colors.primary,
  },
  date: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${colors.secondary}1A`,
    borderWidth: 1,
    borderColor: `${colors.secondary}33`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLabel: {
    color: colors.secondary,
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  clock: {
    alignItems: 'center',
    gap: 2,
  },
  time: {
    fontFamily: fontFamily.semiBold,
    fontSize: 56,
    color: colors.primary,
    letterSpacing: -1,
  },
  timeLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  punchArea: {
    alignItems: 'center',
    gap: spacing.md,
  },
  nextLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
