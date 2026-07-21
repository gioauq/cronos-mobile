import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, FloppyDisk, User } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AttachmentFile, updateProfile } from '../api/profile';
import { useAsyncAction } from '../hooks/useAsyncAction';

export function EditProfileScreen() {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [photo, setPhoto] = useState<AttachmentFile | null>(null);

  const { run: save, isLoading: saving } = useAsyncAction(
    async () => {
      await updateProfile({ email, photo: photo ?? undefined });
      await refreshUser();
      return true;
    },
    () => Alert.alert('Erro', 'Não foi possível salvar seus dados. Verifique sua conexão e tente novamente.')
  );

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para alterar sua foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, name: asset.fileName ?? `perfil-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const handleSave = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('E-mail inválido', 'Informe um e-mail válido.');
      return;
    }

    const result = await save();
    if (result !== undefined) {
      Alert.alert('Perfil atualizado', 'Seus dados foram salvos com sucesso.', [
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
        <Text style={styles.title}>Editar Perfil</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.avatarWrapper} onPress={pickPhoto}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <User size={40} color={colors.primaryForeground} weight="bold" />
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Camera size={16} color={colors.primaryForeground} weight="bold" />
          </View>
        </Pressable>
        <Text style={styles.avatarHint}>Toque para alterar a foto</Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <FloppyDisk size={18} color={colors.primaryForeground} weight="bold" />
              <Text style={styles.saveLabel}>Salvar Alterações</Text>
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
  content: { padding: spacing.lg, gap: spacing.sm, alignItems: 'stretch', paddingBottom: spacing.xl },
  avatarWrapper: { alignSelf: 'center', marginTop: spacing.md },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 96, height: 96, borderRadius: radius.full, backgroundColor: colors.muted },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarHint: { textAlign: 'center', fontFamily: fontFamily.medium, fontSize: 12, color: colors.mutedForeground, marginBottom: spacing.md },
  label: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  saveLabel: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.primaryForeground },
});
