import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowsLeftRight, Warning } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import {
  acceptSwap,
  cancelSwap,
  declineSwap,
  fetchSwaps,
  SwapItem,
  SwapOverview,
  swapErrorMessage,
} from '../api/swaps';
import { RequestSwapSheet } from '../components/RequestSwapSheet';
import { formatDayMonth, formatShortDay } from '../lib/dates';

const STATUS_COLORS: Record<SwapItem['status'], string> = {
  awaiting_counterpart: colors.secondary,
  awaiting_approval: colors.secondary,
  approved: colors.accent,
  completed: colors.accent,
  rejected: colors.destructive,
  cancelled: colors.destructive,
};

/**
 * Troca de serviço do servidor: pedir a troca de um plantão, responder o pedido de um colega e acompanhar o
 * andamento. A tela só é registrada para quem está numa escala que permite a troca (can_swap_shifts).
 */
export function ShiftSwapsScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState<SwapOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestDate, setRequestDate] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchSwaps());
    } catch (e) {
      setError(swapErrorMessage(e, 'Não foi possível carregar as trocas. Verifique sua conexão.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const respond = (swap: SwapItem, action: 'accept' | 'decline' | 'cancel') => {
    const copy = {
      accept: { title: 'Aceitar o pedido?', body: `Você cobre o plantão de ${formatDayMonth(swap.service_date ?? '')} e ${swap.other_name} cobre o seu em ${formatDayMonth(swap.payback_date ?? '')}. A gestão ainda precisa aprovar.`, ok: 'Aceitar', run: acceptSwap },
      decline: { title: 'Recusar o pedido?', body: `${swap.other_name} será avisado(a).`, ok: 'Recusar', run: declineSwap },
      cancel: { title: 'Cancelar o pedido?', body: 'O pedido deixa de valer e o dia volta a poder ser trocado.', ok: 'Cancelar pedido', run: cancelSwap },
    }[action];

    Alert.alert(copy.title, copy.body, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: copy.ok,
        style: action === 'accept' ? 'default' : 'destructive',
        onPress: async () => {
          setBusyId(swap.id);
          try {
            await copy.run(swap.id);
          } catch (e) {
            Alert.alert('Não foi possível', swapErrorMessage(e, 'Verifique sua conexão e tente novamente.'));
          } finally {
            setBusyId(null);
            load();
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
          <ArrowLeft size={22} color={colors.primary} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Troca de Serviço</Text>
        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error || !data ? (
        <View style={styles.center}>
          <Warning size={32} color={colors.destructive} weight="bold" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryLabel}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {data.incoming.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Pedidos para você</Text>
              {data.incoming.map((swap) => (
                <View key={swap.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{swap.other_name} pede que você cubra</Text>
                  <Text style={styles.cardText}>
                    Você cobre em {formatShortDay(swap.service_date ?? '')} e {swap.other_name} cobre você em {formatShortDay(swap.payback_date ?? '')}.
                  </Text>
                  {swap.reason ? <Text style={styles.reason}>“{swap.reason}”</Text> : null}
                  <View style={styles.actions}>
                    <Pressable style={[styles.button, styles.buttonPrimary]} disabled={busyId === swap.id} onPress={() => respond(swap, 'accept')}>
                      <Text style={styles.buttonPrimaryLabel}>Aceitar</Text>
                    </Pressable>
                    <Pressable style={[styles.button, styles.buttonDanger]} disabled={busyId === swap.id} onPress={() => respond(swap, 'decline')}>
                      <Text style={styles.buttonDangerLabel}>Recusar</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}

          <Text style={styles.sectionLabel}>Meus próximos plantões</Text>
          {data.upcoming_shifts.length === 0 ? (
            <Text style={styles.emptyText}>Você não tem plantões nos próximos dias.</Text>
          ) : (
            data.upcoming_shifts.map((shift) => (
              <View key={shift.date} style={[styles.card, styles.shiftCard]}>
                <View style={styles.flex}>
                  <Text style={styles.shiftDate}>{formatShortDay(shift.date)}</Text>
                  <Text style={styles.cardText}>{shift.label}</Text>
                </View>
                {shift.pending ? (
                  <View style={[styles.badge, { backgroundColor: `${colors.secondary}26` }]}>
                    <Text style={[styles.badgeText, { color: colors.secondary }]}>Pedido em andamento</Text>
                  </View>
                ) : (
                  <Pressable style={[styles.button, styles.buttonOutline]} onPress={() => setRequestDate(shift.date)}>
                    <ArrowsLeftRight size={14} color={colors.primary} weight="bold" />
                    <Text style={styles.buttonOutlineLabel}>Pedir troca</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}

          <Text style={styles.sectionLabel}>Minhas trocas</Text>
          {data.mine.length === 0 ? (
            <Text style={styles.emptyText}>Você ainda não fez nenhuma troca.</Text>
          ) : (
            data.mine.map((swap) => (
              <View key={swap.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>
                    {swap.role === 'requester' ? 'Você sai em' : 'Você cobre em'} {formatDayMonth(swap.service_date ?? '')}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[swap.status]}26` }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLORS[swap.status] }]}>{swap.status_label}</Text>
                  </View>
                </View>
                <Text style={styles.cardText}>
                  {swap.other_name} ·{' '}
                  {swap.role === 'requester'
                    ? `devolução em ${formatDayMonth(swap.payback_date ?? '')}`
                    : `cobre você em ${formatDayMonth(swap.payback_date ?? '')}`}
                </Text>
                {swap.can_cancel && (
                  <View style={styles.actions}>
                    <Pressable style={[styles.button, styles.buttonDanger]} disabled={busyId === swap.id} onPress={() => respond(swap, 'cancel')}>
                      <Text style={styles.buttonDangerLabel}>Cancelar pedido</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <RequestSwapSheet date={requestDate} onClose={() => setRequestDate(null)} onSent={load} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontFamily: fontFamily.medium, color: colors.destructive, textAlign: 'center' },
  retryButton: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.primary },
  retryLabel: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.primaryForeground },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  emptyText: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.mutedForeground },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  shiftCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.foreground, flexShrink: 1 },
  cardText: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.mutedForeground },
  shiftDate: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.foreground, textTransform: 'capitalize' },
  reason: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.foreground },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryLabel: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.primaryForeground },
  buttonDanger: { borderWidth: 1, borderColor: colors.destructive },
  buttonDangerLabel: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.destructive },
  buttonOutline: { borderWidth: 1, borderColor: colors.primary },
  buttonOutlineLabel: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.primary },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { fontFamily: fontFamily.bold, fontSize: 10, textTransform: 'uppercase' },
});
