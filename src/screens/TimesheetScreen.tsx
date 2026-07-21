import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, Camera, CaretLeft, CaretRight, DownloadSimple, MapPin, Receipt, Warning } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { downloadPunchReceipt, downloadTimesheetPdf, fetchTimesheet, TimesheetResponse } from '../api/profile';
import { useAsyncAction } from '../hooks/useAsyncAction';

type Day = TimesheetResponse['days'][number];

const STATUS_LABELS: Record<Day['status'], string> = {
  not_calculated: 'Não calculado',
  falta: 'Falta',
  absence: 'Afastamento',
  holiday: 'Feriado',
  day_off: 'Folga',
  processed: 'Normal',
};

const STATUS_COLORS: Record<Day['status'], string> = {
  not_calculated: colors.mutedForeground,
  falta: colors.destructive,
  absence: colors.secondary,
  holiday: colors.accent,
  day_off: colors.mutedForeground,
  processed: colors.primary,
};

function monthKey(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, m - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function TimesheetScreen() {
  const navigation = useNavigation();
  const [monthOffset, setMonthOffset] = useState(0);
  const [data, setData] = useState<TimesheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const month = monthKey(monthOffset);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTimesheet(month);
      setData(response);
    } catch {
      setError('Não foi possível carregar o espelho de ponto. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const { run: handleDownload, isLoading: downloading } = useAsyncAction(
    useCallback(async () => {
      const fileUri = await downloadTimesheetPdf(month);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Cartão de Ponto' });
      } else {
        Alert.alert('Comprovante baixado', `Arquivo salvo em:\n${fileUri}`);
      }
    }, [month]),
    () => Alert.alert('Erro', 'Não foi possível baixar o comprovante em PDF.')
  );

  const balance = data?.total_balance_hours ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
          <ArrowLeft size={22} color={colors.primary} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Meu Ponto</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => setMonthOffset((o) => o - 1)} hitSlop={12} style={styles.iconButton}>
          <CaretLeft size={20} color={colors.primary} weight="bold" />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
        <Pressable
          onPress={() => setMonthOffset((o) => Math.min(o + 1, 0))}
          hitSlop={12}
          style={styles.iconButton}
          disabled={monthOffset >= 0}
        >
          <CaretRight size={20} color={monthOffset >= 0 ? colors.muted : colors.primary} weight="bold" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Warning size={32} color={colors.destructive} weight="bold" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Saldo do Banco de Horas</Text>
            <Text style={[styles.balanceValue, { color: balance >= 0 ? colors.accent : colors.destructive }]}>
              {balance > 0 ? '+' : ''}
              {balance}h
            </Text>
          </View>

          <Pressable style={styles.downloadButton} onPress={handleDownload} disabled={downloading}>
            {downloading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <DownloadSimple size={18} color={colors.primaryForeground} weight="bold" />
                <Text style={styles.downloadLabel}>Baixar Comprovante PDF</Text>
              </>
            )}
          </Pressable>

          <View style={styles.daysCard}>
            {data?.days.map((day, index) => (
              <DayRow key={day.date} day={day} isLast={index === data.days.length - 1} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

async function handlePunchReceiptDownload(punchId: number) {
  try {
    const fileUri = await downloadPunchReceipt(punchId);
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Comprovante de Marcação' });
    } else {
      Alert.alert('Comprovante baixado', `Arquivo salvo em:\n${fileUri}`);
    }
  } catch {
    Alert.alert('Erro', 'Não foi possível baixar o comprovante desta marcação.');
  }
}

function DayRow({ day, isLast }: { day: Day; isLast: boolean }) {
  const dateObj = new Date(`${day.date}T00:00:00`);
  const label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' }).format(dateObj);
  const statusColor = STATUS_COLORS[day.status] ?? colors.mutedForeground;

  return (
    <View style={[styles.dayRow, !isLast && styles.dayRowBorder]}>
      <View style={styles.dayDate}>
        <Text style={styles.dayDateText}>{label}</Text>
      </View>
      <View style={styles.dayPunches}>
        {day.punches.length > 0 ? (
          <View style={styles.punchList}>
            {day.punches.map((punch, index) => (
              <View key={`${punch.time}-${index}`} style={styles.punchItem}>
                <Text style={styles.dayPunchesText}>{punch.time}</Text>
                {punch.selfie_url && (
                  <Pressable onPress={() => Linking.openURL(punch.selfie_url!)} hitSlop={6} accessibilityLabel="Ver foto da marcação">
                    <Camera size={13} color={colors.primary} weight="fill" />
                  </Pressable>
                )}
                {punch.latitude && punch.longitude && (
                  <Pressable
                    onPress={() => Linking.openURL(`https://www.google.com/maps?q=${punch.latitude},${punch.longitude}`)}
                    hitSlop={6}
                    accessibilityLabel="Ver localização da marcação"
                  >
                    <MapPin size={13} color={colors.primary} weight="fill" />
                  </Pressable>
                )}
                <Pressable onPress={() => handlePunchReceiptDownload(punch.id)} hitSlop={6} accessibilityLabel="Baixar comprovante desta marcação">
                  <Receipt size={13} color={colors.primary} weight="fill" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.dayPunchesText}>—</Text>
        )}
        {day.has_inconsistency && <Text style={styles.dayInconsistency}>Inconsistência</Text>}
      </View>
      <View style={styles.dayHours}>
        <Text style={styles.dayHoursText}>
          {day.worked_hours}h / {day.expected_hours}h
        </Text>
        <Text style={[styles.dayStatus, { color: statusColor }]}>{STATUS_LABELS[day.status] ?? day.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.primary },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthLabel: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.foreground, minWidth: 160, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontFamily: fontFamily.medium, color: colors.destructive, textAlign: 'center' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: { fontFamily: fontFamily.semiBold, fontSize: 12, color: `${colors.primaryForeground}CC`, textTransform: 'uppercase', letterSpacing: 1 },
  balanceValue: { fontFamily: fontFamily.extraBold, fontSize: 32 },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  downloadLabel: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.primaryForeground },
  daysCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dayRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dayDate: { width: 56 },
  dayDateText: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.primary, textTransform: 'capitalize' },
  dayPunches: { flex: 1, gap: 2 },
  punchList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  punchItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayPunchesText: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.foreground },
  dayInconsistency: { fontFamily: fontFamily.semiBold, fontSize: 10, color: colors.destructive, textTransform: 'uppercase' },
  dayHours: { alignItems: 'flex-end', gap: 2 },
  dayHoursText: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.foreground },
  dayStatus: { fontFamily: fontFamily.bold, fontSize: 10, textTransform: 'uppercase' },
});
