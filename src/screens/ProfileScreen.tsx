import React from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Briefcase, CalendarCheck, CaretRight, IdentificationCard, PencilSimple, SignOut, User } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  employee: 'Funcionário',
};

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();

  const confirmSignOut = () => {
    Alert.alert('Sair do aplicativo', 'Deseja realmente sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <User size={48} color={colors.primaryForeground} weight="bold" />
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informações</Text>
          <InfoRow icon={<IdentificationCard size={20} color={colors.primary} weight="bold" />} label="E-mail" value={user?.email ?? '—'} />
          <View style={styles.separator} />
          <InfoRow icon={<Briefcase size={20} color={colors.primary} weight="bold" />} label="Perfil de acesso" value={ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? '—'} />
        </View>

        <View style={styles.card}>
          <Pressable style={styles.actionRow} onPress={() => navigation.navigate('Timesheet')}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBox}>
                <CalendarCheck size={20} color={colors.primary} weight="bold" />
              </View>
              <Text style={styles.actionLabel}>Meu Ponto</Text>
            </View>
            <CaretRight size={18} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.separator} />
          <Pressable style={styles.actionRow} onPress={() => navigation.navigate('Justification')}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBox}>
                <IdentificationCard size={20} color={colors.primary} weight="bold" />
              </View>
              <Text style={styles.actionLabel}>Enviar Justificativa</Text>
            </View>
            <CaretRight size={18} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.separator} />
          <Pressable style={styles.actionRow} onPress={() => navigation.navigate('EditProfile')}>
            <View style={styles.actionLeft}>
              <View style={styles.iconBox}>
                <PencilSimple size={20} color={colors.primary} weight="bold" />
              </View>
              <Text style={styles.actionLabel}>Editar Perfil</Text>
            </View>
            <CaretRight size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Pressable style={styles.actionRow} onPress={confirmSignOut}>
            <View style={styles.actionLeft}>
              <View style={[styles.iconBox, styles.iconBoxDanger]}>
                <SignOut size={20} color={colors.destructive} weight="bold" />
              </View>
              <Text style={styles.actionLabelDanger}>Sair do Aplicativo</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.footer}>Cronos • Ponto Eletrônico</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.actionLeft}>
      <View style={styles.iconBox}>{icon}</View>
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    gap: 4,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: `${colors.accent}33`,
    borderWidth: 3,
    borderColor: `${colors.accent}66`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: colors.primaryForeground,
  },
  role: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: `${colors.primaryForeground}B3`,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.muted}80`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
    color: colors.foreground,
  },
  iconBoxDanger: {
    backgroundColor: `${colors.destructive}1A`,
  },
  actionLabelDanger: {
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
    color: colors.destructive,
  },
  infoLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
    color: colors.primary,
  },
  footer: {
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
  },
});
