import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Image, Pressable, SafeAreaView, SectionList, StyleSheet, Text, View } from 'react-native';
import { ArrowsClockwise, CheckCircle, MapPin, WarningCircle } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getRecentRecords, PendingRecord, resetToPending, SYNC_PENDING, SYNC_REJECTED, SYNC_SYNCED } from '../db/database';
import { PUNCH_LABELS } from '../lib/punchFlow';
import { trySync } from '../lib/sync';

type Section = { title: string; data: PendingRecord[] };

export function HistoryScreen() {
  const { user } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [onlyPending, setOnlyPending] = useState(false);
  const [retryingHash, setRetryingHash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const records = await getRecentRecords(user.id, 200);
    setSections(groupByDay(records));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRetry = useCallback(
    async (hash: string) => {
      if (!user) return;
      setRetryingHash(hash);
      try {
        await resetToPending(hash);
        await trySync(user.id);
      } finally {
        setRetryingHash(null);
        await load();
      }
    },
    [user, load]
  );

  const visibleSections = onlyPending
    ? sections
        .map((section) => ({ ...section, data: section.data.filter((r) => r.synced !== SYNC_SYNCED) }))
        .filter((section) => section.data.length > 0)
    : sections;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico</Text>
        <Pressable style={[styles.filterChip, onlyPending && styles.filterChipActive]} onPress={() => setOnlyPending((v) => !v)}>
          <Text style={[styles.filterChipLabel, onlyPending && styles.filterChipLabelActive]}>Pendentes</Text>
        </Pressable>
      </View>
      <SectionList
        sections={visibleSections}
        keyExtractor={(item) => item.hash}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <HistoryRow record={item} onRetry={handleRetry} isRetrying={retryingHash === item.hash} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {onlyPending ? 'Nenhuma marcação pendente. Tudo sincronizado.' : 'Nenhuma marcação de ponto ainda.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function HistoryRow({
  record,
  onRetry,
  isRetrying,
}: {
  record: PendingRecord;
  onRetry: (hash: string) => void;
  isRetrying: boolean;
}) {
  const time = new Date(record.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const location =
    record.latitude != null && record.longitude != null
      ? `${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}`
      : 'Localização não disponível';

  return (
    <View style={styles.row}>
      {record.selfie_uri && <Image source={{ uri: record.selfie_uri }} style={styles.selfieThumb} />}
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.typeLabel}>{PUNCH_LABELS[record.type]}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <MapPin size={14} color={colors.mutedForeground} weight="fill" />
          <Text style={styles.location} numberOfLines={1}>
            {location}
          </Text>
        </View>
        <SyncStatus status={record.synced} reason={record.reject_reason} />
      </View>
      {record.synced === SYNC_REJECTED && (
        <Pressable style={styles.retryButton} onPress={() => onRetry(record.hash)} disabled={isRetrying} hitSlop={8}>
          <ArrowsClockwise size={16} color={colors.primaryForeground} weight="bold" />
        </Pressable>
      )}
    </View>
  );
}

function SyncStatus({ status, reason }: { status: number; reason: string | null }) {
  if (status === SYNC_SYNCED) {
    return (
      <View style={styles.detailRow}>
        <CheckCircle size={14} color={colors.accent} weight="fill" />
        <Text style={styles.statusSynced}>Sincronizado</Text>
      </View>
    );
  }
  if (status === SYNC_REJECTED) {
    return (
      <View style={styles.detailRow}>
        <WarningCircle size={14} color={colors.destructive} weight="fill" />
        <Text style={styles.statusRejected}>Rejeitado{reason ? ` (${reason})` : ''}</Text>
      </View>
    );
  }
  return (
    <View style={styles.detailRow}>
      <ArrowsClockwise size={14} color={colors.secondary} weight="bold" />
      <Text style={styles.statusPending}>Sincronização pendente</Text>
    </View>
  );
}

function groupByDay(records: PendingRecord[]): Section[] {
  const groups = new Map<string, PendingRecord[]>();
  for (const record of records) {
    const key = new Date(record.recorded_at).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  }

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  return Array.from(groups.entries()).map(([key, data]) => ({
    title: key === today ? 'Hoje' : key === yesterday ? 'Ontem' : formatDayTitle(data[0].recorded_at),
    data,
  }));
}

function formatDayTitle(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(new Date(iso));
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
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.primary,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    color: colors.foreground,
  },
  filterChipLabelActive: {
    color: colors.primaryForeground,
  },
  retryButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    backgroundColor: `${colors.muted}80`,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  selfieThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
  },
  timeColumn: {
    alignItems: 'center',
    width: 56,
  },
  time: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.primary,
  },
  typeLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  details: {
    flex: 1,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  location: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.foreground,
    flexShrink: 1,
  },
  statusSynced: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  statusPending: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.secondary,
  },
  statusRejected: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.destructive,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    color: colors.mutedForeground,
  },
});
