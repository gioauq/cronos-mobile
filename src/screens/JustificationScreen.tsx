import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, Camera, FileText, PaperPlaneTilt } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { AttachmentFile, JUSTIFICATION_TYPE_LABELS, JustificationType, submitJustification } from '../api/profile';
import { useAsyncAction } from '../hooks/useAsyncAction';

const TYPES = Object.keys(JUSTIFICATION_TYPE_LABELS) as JustificationType[];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function JustificationScreen() {
  const navigation = useNavigation();
  const [type, setType] = useState<JustificationType>('justification');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null);

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
      Alert.alert('Enviado', 'Justificativa enviada com sucesso. O anexo foi armazenado de forma criptografada.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={12}>
          <ArrowLeft size={22} color={colors.primary} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Justificativa</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
              <Text style={styles.submitLabel}>Enviar Justificativa</Text>
            </>
          )}
        </Pressable>
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
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
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
