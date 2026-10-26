import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ArrowsClockwise } from 'phosphor-react-native';
import { colors, fontFamily, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { useLocationWarmup } from '../hooks/useLocationWarmup';
import { OfflineBanner } from '../components/OfflineBanner';
import { PunchButton } from '../components/PunchButton';
import { LocationCard } from '../components/LocationCard';
import { acquireCoordinates, reverseGeocode, LocationFailure, LocationStage } from '../lib/location';
import { generatePunchHash } from '../lib/hash';
import { captureSelfie, deleteSelfie } from '../lib/selfie';
import { checkGeofence } from '../lib/geofence';
import { insertPunch, getRecentRecords, upsertFromServer, PunchType } from '../db/database';
import { nextPunchType, PUNCH_LABELS } from '../lib/punchFlow';
import { fetchTodayRecords } from '../api/timeRecords';

const TODAY_LABEL = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

const STAGE_LABELS: Record<LocationStage, string> = {
  permission: 'Verificando permissão…',
  last_known: 'Obtendo localização…',
  services: 'Ligando a localização do aparelho…',
  fresh: 'Procurando sinal de GPS…',
};

export function HomeScreen() {
  const { user } = useAuth();
  const { isOnline, pendingCount, syncNow } = useSyncEngine(user?.id);
  // GPS aquecido enquanto a tela está aberta: no toque, o fix normalmente já existe.
  const { warmFix, warmFixRef, recheck: recheckLocationPermission } = useLocationWarmup(!!user?.requiresLocation);

  const [now, setNow] = useState(new Date());
  // A próxima batida é DERIVADA da última batida + a hora atual (que anda a cada segundo): assim o rótulo vira
  // "Saída" sozinho quando passa de 1h30 do almoço e volta a "Entrada" na virada do dia, sem precisar recarregar.
  const [lastPunch, setLastPunch] = useState<{ type: PunchType; recordedAt: string; beforeType: PunchType | null } | null>(null);
  const nextType = nextPunchType(lastPunch, now);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStage, setLocationStage] = useState<LocationStage | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  // O cartão mostra o fix do aquecimento enquanto nenhuma batida produziu coordenada própria,
  // assim a pessoa vê que o GPS já está pronto ANTES de tocar no botão.
  const shownCoordinates = coordinates ?? warmFix?.coords ?? null;

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

  // Endereço do fix aquecido, uma vez só — sem isto o cartão mostra a coordenada pronta mas
  // escreve "Endereço não identificado" antes da primeira batida.
  useEffect(() => {
    if (address || !shownCoordinates) return;
    reverseGeocode(shownCoordinates).then(setAddress);
  }, [address, shownCoordinates]);

  const savePunch = useCallback(
    async (
      selfieUri: string | null,
      coords: { latitude: number; longitude: number } | null,
      recordedAt: string
    ) => {
      if (!user) return;
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

  /**
   * A localização falhou de vez. O que acontece depende de QUEM pode resolver:
   * - permissão negada / localização desligada: só o usuário resolve, então a batida não é
   *   gravada e ele recebe o caminho pra consertar. Isso também fecha a brecha de negar a
   *   permissão de propósito pra toda batida cair em quarentena.
   * - sem fix com tudo ligado e permitido (subsolo, prédio): não é culpa dele, a batida é
   *   gravada sem coordenada e vai para Marcações Divergentes como "Sem localização".
   *
   * Sempre retorna true: todos os caminhos deixam um Alert aberto e resetam isSubmitting neles.
   */
  const handleLocationFailure = (
    failure: LocationFailure,
    selfieUri: string | null,
    recordedAt: string
  ): boolean => {
    const abort = () => {
      deleteSelfie(selfieUri);
      setIsSubmitting(false);
    };

    if (failure === 'permission_denied') {
      Alert.alert(
        'Localização bloqueada',
        'O Cronos não tem permissão para usar sua localização, e ela é obrigatória na sua marcação de ponto.'
          + ' Libere nos ajustes do aparelho e bata o ponto de novo.',
        [
          { text: 'Cancelar', style: 'cancel', onPress: abort },
          {
            text: 'Abrir ajustes',
            onPress: () => {
              abort();
              Linking.openSettings();
            },
          },
        ]
      );

      return true;
    }

    if (failure === 'services_disabled') {
      Alert.alert(
        'Localização desligada',
        'A localização do aparelho está desligada e ela é obrigatória na sua marcação de ponto.'
          + ' Ligue a localização e bata o ponto de novo.',
        [{ text: 'Entendi', onPress: abort }]
      );

      return true;
    }

    Alert.alert(
      'Sem sinal de GPS',
      'Não conseguimos sua localização agora, mesmo com o GPS ligado. Você pode tentar de novo ou registrar'
        + ' sem localização — nesse caso a marcação vai para análise do RH e só entra na folha depois de liberada.',
      [
        { text: 'Tentar de novo', style: 'cancel', onPress: abort },
        {
          text: 'Registrar sem localização',
          onPress: async () => {
            await savePunch(selfieUri, null, recordedAt);
            setIsSubmitting(false);
          },
        },
      ]
    );

    return true;
  };

  /**
   * Segunda metade da batida: localização, geofence e gravação. Separada de handlePunch porque a
   * batida sem selfie continua por aqui depois que o servidor confirma no alerta.
   *
   * `flush` é o envio da fila pendente disparado no toque — a gravação espera por ele porque o
   * servidor corrige o tipo da batida lendo a ANTERIOR já gravada no banco: uma entrada presa
   * na fila precisa chegar antes da saída nova.
   *
   * Retorna true quando deixou um Alert aberto e vai resetar isSubmitting sozinha — devolver isso
   * em vez de resetar aqui é o que impede o botão de reabilitar enquanto a decisão está pendente.
   */
  const continuePunch = async (
    selfieUri: string | null,
    recordedAt: string,
    flush: Promise<void>
  ): Promise<boolean> => {
    if (!user) return false;

    let coords: { latitude: number; longitude: number } | null = null;
    if (user.requiresLocation) {
      setIsLocating(true);

      // Localização e fila correm JUNTAS: são duas esperas de rede/sensor e não há motivo
      // pra somá-las no tempo que a pessoa fica olhando o botão.
      const [result] = await Promise.all([
        acquireCoordinates({ warmFix: warmFixRef.current, onStage: setLocationStage }),
        flush,
      ]);

      setIsLocating(false);
      setLocationStage(null);

      if (!result.ok) {
        // Pode ter liberado a permissão nos ajustes durante o alerta anterior — religa o
        // aquecimento pra próxima tentativa já ter fix.
        recheckLocationPermission();

        return handleLocationFailure(result.failure, selfieUri, recordedAt);
      }

      coords = result.coords;
      setCoordinates(coords);
      reverseGeocode(coords).then(setAddress);

      if (user.workUnit) {
        const { withinRadius, distanceMeters } = checkGeofence(coords, user.workUnit);

        if (!withinRadius) {
          Alert.alert(
            'Fora do perímetro',
            `Você está a ${distanceMeters}m de ${user.workUnit.name} (raio permitido: ${user.workUnit.radius_meters}m). A marcação será salva e enviada para análise do RH — ela só entra na folha depois de liberada.`,
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
                  await savePunch(selfieUri, coords, recordedAt);
                  setIsSubmitting(false);
                },
              },
            ]
          );

          return true;
        }
      }
    } else {
      await flush;
    }

    await savePunch(selfieUri, coords, recordedAt);

    return false;
  };

  const handlePunch = async () => {
    if (!user) return;

    // Estampado no TOQUE, não no fim do processo: selfie + GPS podem levar dezenas de segundos
    // e a hora que vale é a que a pessoa bateu.
    const recordedAt = new Date().toISOString();

    // Dispara já, sem await: a fila pendente vai sendo enviada enquanto a pessoa tira a selfie
    // e o GPS fixa. Quem espera por ela é continuePunch, antes de gravar a batida nova.
    const flush = pendingCount > 0 ? syncNow() : Promise.resolve();

    setIsSubmitting(true);
    // Fica true até o usuário decidir o alerta de fora-do-perímetro abaixo — sem essa
    // flag, o finally reseta isSubmitting assim que o Alert.alert (não-bloqueante) é
    // exibido, reabilitando o botão de bater ponto enquanto a decisão ainda está pendente.
    let deferResetToAlert = false;
    try {
      let selfieUri: string | null = null;
      if (user.requiresSelfie) {
        selfieUri = await captureSelfie();

        // Sem selfie a batida NÃO é mais abandonada: ela pode seguir sem a foto e o servidor a
        // grava em quarentena (Marcações Divergentes), onde o RH libera ou recusa. Perder a hora
        // trabalhada porque a câmera falhou era pior do que registrar com uma pendência.
        if (!selfieUri) {
          deferResetToAlert = true;
          Alert.alert(
            'Selfie não capturada',
            'A marcação de ponto exige uma selfie. Você pode tentar de novo ou registrar sem a foto — nesse caso a marcação vai para análise do RH e só entra na folha depois de liberada.',
            [
              { text: 'Tentar de novo', style: 'cancel', onPress: () => setIsSubmitting(false) },
              {
                text: 'Registrar sem selfie',
                onPress: async () => {
                  const deferred = await continuePunch(null, recordedAt, flush);
                  if (!deferred) setIsSubmitting(false);
                },
              },
            ]
          );
          return;
        }
      }

      deferResetToAlert = await continuePunch(selfieUri, recordedAt, flush);
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

        {user?.requiresLocation && (
          <LocationCard
            isLoading={isLocating}
            address={address}
            coordinates={shownCoordinates}
            statusLabel={locationStage ? STAGE_LABELS[locationStage] : null}
          />
        )}
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
