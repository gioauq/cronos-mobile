import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, CalendarBlank, Camera, CaretLeft, CaretRight, FilePdf, MapPin, Receipt, Warning } from 'phosphor-react-native';
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

/** Converte horas decimais (ex: 15.33) em "HH:MM" (ex: "15:20") — o formato usado no desenho. */
function formatHoursAsClock(hours: number): string {
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Agrupa as marcações do dia em pares entrada/saída ("08:00 - 12:00 | 13:00 - 18:00"). */
function formatShiftRanges(punches: Day['punches']): string {
  if (punches.length === 0) return '';
  const ranges: string[] = [];
  for (let i = 0; i < punches.length; i += 2) {
    const start = punches[i].time;
    const end = punches[i + 1]?.time;
    ranges.push(end ? `${start} - ${end}` : start);
  }
  return ranges.join(' | ');
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
  const overtimeTotal = (data?.days ?? []).reduce((sum, day) => sum + Math.max(day.balance_hours, 0), 0);
  const shortfallTotal = (data?.days ?? []).reduce((sum, day) => sum + Math.max(-day.balance_hours, 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
          <ArrowLeft size={22} color={colors.primary} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Meu Ponto</Text>
        <Pressable style={styles.pdfButton} onPress={handleDownload} disabled={downloading} hitSlop={8}>
          {downloading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <FilePdf size={16} color={colors.primaryForeground} weight="bold" />
              <Text style={styles.pdfButtonLabel}>PDF</Text>
            </>
          )}
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
          <View style={styles.periodRow}>
            <View>
              <Text style={styles.periodLabel}>Período Selecionado</Text>
              <View style={styles.monthNav}>
                <Pressable onPress={() => setMonthOffset((o) => o - 1)} hitSlop={12}>
                  <CaretLeft size={18} color={colors.primary} weight="bold" />
                </Pressable>
                <Text style={styles.monthValue}>{formatMonthLabel(month)}</Text>
                <Pressable onPress={() => setMonthOffset((o) => Math.min(o + 1, 0))} hitSlop={12} disabled={monthOffset >= 0}>
                  <CaretRight size={18} color={monthOffset >= 0 ? colors.muted : colors.primary} weight="bold" />
                </Pressable>
              </View>
            </View>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillLabel}>Saldo Total</Text>
              <Text style={[styles.balancePillValue, { color: balance >= 0 ? colors.accent : colors.destructive }]}>
                {balance >= 0 ? '+' : '-'}
                {formatHoursAsClock(balance)}
              </Text>
            </View>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Horas Extras</Text>
              <Text style={[styles.statValue, { color: colors.accent }]}>{formatHoursAsClock(overtimeTotal)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Atrasos/Faltas</Text>
              <Text style={[styles.statValue, { color: colors.destructive }]}>{formatHoursAsClock(shortfallTotal)}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Detalhamento Diário</Text>

          <View style={styles.daysList}>
            {data?.days.map((day) => (
              <DayCard key={day.date} day={day} />
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

function DayCard({ day }: { day: Day }) {
  const dateObj = new Date(`${day.date}T00:00:00`);
  const label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' }).format(dateObj);
  const shiftRanges = formatShiftRanges(day.punches);
  const deltaColor = day.balance_hours > 0 ? colors.accent : day.balance_hours < 0 ? colors.destructive : colors.mutedForeground;
  const deltaSign = day.balance_hours > 0 ? '+' : day.balance_hours < 0 ? '-' : '';

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayCardTop}>
        <Text style={styles.dayDate}>{label}</Text>
        <Text style={styles.dayWorked}>{formatHoursAsClock(day.worked_hours)}h</Text>
      </View>
      <View style={styles.dayCardBottom}>
        {shiftRanges ? (
          <View style={styles.punchRow}>
            <Text style={styles.dayDetail}>{shiftRanges}</Text>
            {day.punches.some((p) => p.selfie_url) && (
              <Pressable onPress={() => Linking.openURL(day.punches.find((p) => p.selfie_url)!.selfie_url!)} hitSlop={6} accessibilityLabel="Ver foto da marcação">
                <Camera size={13} color={colors.mutedForeground} weight="fill" />
              </Pressable>
            )}
            {day.punches.some((p) => p.latitude && p.longitude) && (
              <Pressable
                onPress={() => {
                  const p = day.punches.find((p) => p.latitude && p.longitude)!;
                  Linking.openURL(`https://www.google.com/maps?q=${p.latitude},${p.longitude}`);
                }}
                hitSlop={6}
                accessibilityLabel="Ver localização da marcação"
              >
                <MapPin size={13} color={colors.mutedForeground} weight="fill" />
              </Pressable>
            )}
            <Pressable onPress={() => handlePunchReceiptDownload(day.punches[0].id)} hitSlop={6} accessibilityLabel="Baixar comprovante desta marcação">
              <Receipt size={13} color={colors.mutedForeground} weight="fill" />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.dayDetail}>{STATUS_LABELS[day.status] ?? day.status}</Text>
        )}
        <Text style={[styles.dayDelta, { color: deltaColor }]}>
          {deltaSign}
          {formatHoursAsClock(day.balance_hours)}
        </Text>
      </View>
      {day.has_inconsistency && (
        <View style={styles.inconsistencyBadge}>
          <CalendarBlank size={11} color={colors.destructive} weight="bold" />
          <Text style={styles.inconsistencyText}>Inconsistência</Text>
        </View>
      )}
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
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    minWidth: 64,
    justifyContent: 'center',
  },
  pdfButtonLabel: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.primaryForeground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontFamily: fontFamily.medium, color: colors.destructive, textAlign: 'center' },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  periodRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  periodLabel: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthValue: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.primary },
  balancePill: {
    backgroundColor: `${colors.accent}1F`,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  balancePillLabel: { fontFamily: fontFamily.bold, fontSize: 10, color: colors.accentForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  balancePillValue: { fontFamily: fontFamily.extraBold, fontSize: 20 },
  statGrid: { flexDirection: 'row', gap: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: 4,
  },
  statLabel: { fontFamily: fontFamily.bold, fontSize: 10, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: fontFamily.extraBold, fontSize: 22 },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  daysList: { gap: spacing.sm },
  dayCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  dayCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayDate: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.foreground, textTransform: 'capitalize' },
  dayWorked: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.foreground },
  dayCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  punchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  dayDetail: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.mutedForeground },
  dayDelta: { fontFamily: fontFamily.bold, fontSize: 12 },
  inconsistencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inconsistencyText: { fontFamily: fontFamily.semiBold, fontSize: 10, color: colors.destructive, textTransform: 'uppercase' },
});
