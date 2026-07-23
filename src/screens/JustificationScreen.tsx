import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, Camera, FileText, PaperPlaneTilt } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import {
  AttachmentFile,
  fetchJustifications,
  JUSTIFICATION_STATUS_LABELS,
  JUSTIFICATION_TYPE_LABELS,
  JustificationListItem,
  JustificationType,
  submitJustification,
} from '../api/profile';
import { useAsyncAction } from '../hooks/useAsyncAction';

const TYPES = Object.keys(JUSTIFICATION_TYPE_LABELS) as JustificationType[];

const STATUS_COLORS: Record<JustificationListItem['status'], string> = {
  pending: colors.secondary,
  approved: colors.accent,
  rejected: colors.destructive,
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function JustificationScreen() {
  const navigation = useNavigation();
  const [type, setType] = useState<JustificationType>('justification');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null);

  const [history, setHistory] = useState<JustificationListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const items = await fetchJustifications();
      setHistory(items);
    } catch {
      // Silencioso: a lista é um complemento à tela, o formulário continua funcionando sem ela.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const { run: submit, isLoading: submitting } = useAsyncAction(
    () => submitJustification({ type, startDate, endDate, reason, attachment: attachment! }),
    () => Alert.alert('Erro', 'Não foi possível enviar a justificativa. Verifique sua conexão e tente novamente.')
  );

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para anexar um comprovante.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setAttachment({
      uri: asset.uri,
      name: asset.fileName ?? `anexo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setAttachment({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/pdf',
    });
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert('Motivo obrigatório', 'Descreva o motivo da justificativa.');
      return;
    }
    if (!attachment) {
      Alert.alert('Anexo obrigatório', 'Anexe uma foto ou documento (ex: atestado médico).');
      return;
    }

    const result = await submit();
    if (result) {
      setReason('');
      setAttachment(null);
      setStartDate(todayIso());
      setEndDate(todayIso());
      loadHistory();
      Alert.alert('Enviado', 'Justificativa enviada com sucesso. O anexo foi armazenado de forma criptografada.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
          <ArrowLeft size={22} color={colors.primary} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Justificativas</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Nova Solicitação</Text>

          <Text style={styles.label}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
                <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>{JUSTIFICATION_TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>Data Inicial</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>Data Final</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={styles.label}>Motivo</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={reason}
            onChangeText={setReason}
            placeholder="Descreva o motivo da justificativa"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Anexo (foto ou documento)</Text>
          <View style={styles.row}>
            <Pressable style={styles.attachButton} onPress={pickPhoto}>
              <Camera size={18} color={colors.primary} weight="bold" />
              <Text style={styles.attachLabel}>Foto</Text>
            </Pressable>
            <Pressable style={styles.attachButton} onPress={pickDocument}>
              <FileText size={18} color={colors.primary} weight="bold" />
              <Text style={styles.attachLabel}>Documento</Text>
            </Pressable>
          </View>
          {attachment && <Text style={styles.attachmentName}>Anexado: {attachment.name}</Text>}

          <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <PaperPlaneTilt size={18} color={colors.primaryForeground} weight="bold" />
                <Text style={styles.submitLabel}>Enviar Solicitação</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Minhas Solicitações</Text>

        {historyLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>Você ainda não enviou nenhuma justificativa.</Text>
        ) : (
          <View style={styles.historyList}>
            {history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <Text style={styles.historyType}>{JUSTIFICATION_TYPE_LABELS[item.type]}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status]}26` }]}>
                    <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[item.status] }]}>{JUSTIFICATION_STATUS_LABELS[item.status]}</Text>
                  </View>
                </View>
                <Text style={styles.historyDates}>
                  {formatDate(item.start_date)} — {formatDate(item.end_date)}
                </Text>
                <Text style={styles.historyReason} numberOfLines={2}>
                  {item.reason}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyText: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.mutedForeground },
  historyList: { gap: spacing.sm },
  historyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  historyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyType: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.foreground },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusBadgeText: { fontFamily: fontFamily.bold, fontSize: 10, textTransform: 'uppercase' },
  historyDates: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.mutedForeground },
  historyReason: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.foreground },
  label: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  chipRow: { gap: spacing.sm, paddingVertical: 4 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.foreground },
  chipLabelActive: { color: colors.primaryForeground, fontFamily: fontFamily.semiBold },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  input: {
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
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  attachButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  attachLabel: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.primary },
  attachmentName: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.accent },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  submitLabel: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.primaryForeground },
});
