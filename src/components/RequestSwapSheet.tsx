import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, MagnifyingGlass, PaperPlaneTilt, X } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import {
  fetchPaybackDates,
  fetchSwapCandidates,
  requestSwap,
  SwapCandidate,
  swapErrorMessage,
} from '../api/swaps';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { formatShortDay } from '../lib/dates';

type Props = {
  /** Dia (AAAA-MM-DD) do plantão que o servidor quer trocar; null = folha fechada. */
  date: string | null;
  onClose: () => void;
  /** Pedido enviado: a tela de trás recarrega a lista. */
  onSent: () => void;
};

/**
 * Pedir a troca de UM plantão em três passos na mesma folha: quem cobre, quando devolve e (opcional) o motivo.
 * As listas vêm do servidor já filtradas pelas regras (colega livre, escala que permite, dias que fecham a conta).
 */
export function RequestSwapSheet({ date, onClose, onSent }: Props) {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<SwapCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SwapCandidate | null>(null);
  const [paybackDates, setPaybackDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [payback, setPayback] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // Abriu outro dia: recomeça do zero.
  useEffect(() => {
    setSearch('');
    setSelected(null);
    setPaybackDates([]);
    setPayback(null);
    setReason('');
  }, [date]);

  // Colegas livres no dia (a busca espera o servidor ~0,4 s depois da última tecla).
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoadingCandidates(true);
    setCandidatesError(null);

    const timer = setTimeout(async () => {
      try {
        const list = await fetchSwapCandidates(date, search.trim());
        if (!cancelled) setCandidates(list);
      } catch (error) {
        if (!cancelled) setCandidatesError(swapErrorMessage(error, 'Não foi possível carregar os colegas. Verifique sua conexão.'));
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [date, search]);

  // Escolheu o colega: busca os dias em que ele pode ser devolvido.
  useEffect(() => {
    setPayback(null);
    setPaybackDates([]);
    if (!date || !selected) return;
    let cancelled = false;
    setLoadingDates(true);

    fetchPaybackDates(date, selected.id)
      .then((dates) => {
        if (!cancelled) setPaybackDates(dates);
      })
      .catch((error) => {
        if (!cancelled) Alert.alert('Erro', swapErrorMessage(error, 'Não foi possível carregar os dias de devolução.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingDates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, selected]);

  const { run: send, isLoading: sending } = useAsyncAction(
    async () => requestSwap({ date: date!, counterpartId: selected!.id, paybackDate: payback!, reason }),
    (error) => Alert.alert('Não foi possível', swapErrorMessage(error, 'Verifique sua conexão e tente novamente.'))
  );

  const handleSend = async () => {
    if (!selected || !payback) return;
    const swap = await send();
    if (swap) {
      Alert.alert('Pedido enviado', `${selected.name} recebe um aviso. Depois que aceitar, a gestão aprova a troca.`);
      onSent();
      onClose();
    }
  };

  return (
    <Modal visible={date !== null} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.flex}>
              <Text style={styles.sheetTitle}>Pedir troca</Text>
              <Text style={styles.sheetSubtitle}>Plantão de {date ? formatShortDay(date) : ''}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fechar">
              <X size={22} color={colors.mutedForeground} weight="bold" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>1. Quem pode te cobrir?</Text>
            <View style={styles.searchBox}>
              <MagnifyingGlass size={16} color={colors.mutedForeground} weight="bold" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por nome ou matrícula"
                placeholderTextColor={colors.mutedForeground}
                autoCorrect={false}
              />
            </View>

            {loadingCandidates ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : candidatesError ? (
              <Text style={styles.errorText}>{candidatesError}</Text>
            ) : candidates.length === 0 ? (
              <Text style={styles.emptyText}>Ninguém livre neste dia e disponível para troca pelo app.</Text>
            ) : (
              <View style={styles.list}>
                {candidates.map((candidate) => {
                  const active = selected?.id === candidate.id;
                  return (
                    <Pressable
                      key={candidate.id}
                      style={[styles.option, active && styles.optionActive]}
                      onPress={() => setSelected(active ? null : candidate)}
                    >
                      <View style={styles.flex}>
                        <Text style={styles.optionTitle}>{candidate.name}</Text>
                        <Text style={styles.optionMeta}>
                          {[candidate.registration_number ? `#${candidate.registration_number}` : null, candidate.schedule].filter(Boolean).join(' · ')}
                        </Text>
                        {candidate.hints[0] && <Text style={styles.optionHint}>{candidate.hints[0]}</Text>}
                      </View>
                      {active && <Check size={18} color={colors.accent} weight="bold" />}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {selected && (
              <>
                <Text style={styles.label}>2. Quando você devolve?</Text>
                {loadingDates ? (
                  <ActivityIndicator color={colors.primary} style={styles.loader} />
                ) : paybackDates.length === 0 ? (
                  <Text style={styles.emptyText}>Não há dia livre para a devolução com este colega. Escolha outro colega.</Text>
                ) : (
                  <View style={styles.chipWrap}>
                    {paybackDates.map((day) => (
                      <Pressable key={day} onPress={() => setPayback(day)} style={[styles.chip, payback === day && styles.chipActive]}>
                        <Text style={[styles.chipLabel, payback === day && styles.chipLabelActive]}>{formatShortDay(day)}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            {selected && payback && (
              <>
                <Text style={styles.label}>3. Motivo (opcional)</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Ex.: consulta médica"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={500}
                  multiline
                />
              </>
            )}
          </ScrollView>

          <Pressable style={[styles.submitButton, !(selected && payback) && styles.submitDisabled]} onPress={handleSend} disabled={!(selected && payback) || sending}>
            {sending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <PaperPlaneTilt size={18} color={colors.primaryForeground} weight="bold" />
                <Text style={styles.submitLabel}>Enviar pedido</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#0F1F3D99', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.primary },
  sheetSubtitle: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.mutedForeground, textTransform: 'capitalize' },
  body: { padding: spacing.lg, gap: spacing.sm },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontFamily: fontFamily.regular, fontSize: 14, color: colors.foreground },
  loader: { marginVertical: spacing.md },
  errorText: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.destructive },
  emptyText: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.mutedForeground },
  list: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}14` },
  optionTitle: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.foreground },
  optionMeta: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.mutedForeground },
  optionHint: { fontFamily: fontFamily.medium, fontSize: 11, color: colors.secondary, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.foreground, textTransform: 'capitalize' },
  chipLabelActive: { color: colors.primaryForeground, fontFamily: fontFamily.semiBold },
  reasonInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.foreground,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  submitDisabled: { opacity: 0.4 },
  submitLabel: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.primaryForeground },
});
