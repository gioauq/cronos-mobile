import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Eye, EyeSlash, Timer } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { Bond } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useAsyncAction } from '../hooks/useAsyncAction';

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
  let formatted = parts.join('.');
  if (digits.length > 9) {
    formatted += `-${digits.slice(9, 11)}`;
  }
  return formatted;
}

export function LoginScreen() {
  const { signIn } = useAuth();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Duplo vínculo: preenchido quando o CPF tem mais de uma matrícula — a tela troca pro
  // seletor de vínculo e o mesmo "Entrar" conclui o login na matrícula escolhida.
  const [bonds, setBonds] = useState<Bond[] | null>(null);
  const [selectedBond, setSelectedBond] = useState<string | null>(null);

  const { run: submit, isLoading: isSubmitting } = useAsyncAction(
    async (cpfValue: string, passwordValue: string, registrationNumber?: string) => {
      const pendingBonds = await signIn(cpfValue, passwordValue, registrationNumber);
      if (pendingBonds) {
        setBonds(pendingBonds);
        setSelectedBond(pendingBonds[0]?.registration_number ?? null);
      }
    },
    (err: any) => {
      const message =
        err?.response?.data?.errors?.cpf?.[0] ?? 'Não foi possível entrar. Verifique suas credenciais e a conexão.';
      setError(message);
    }
  );

  const handleSubmit = () => {
    setError(null);
    submit(cpf, password);
  };

  const handleBondSubmit = () => {
    if (!selectedBond) return;
    setError(null);
    submit(cpf, password, selectedBond);
  };

  const handleBackToCredentials = () => {
    setBonds(null);
    setSelectedBond(null);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Timer size={48} color={colors.primaryForeground} weight="bold" />
          </View>
          <Text style={styles.title}>Cronos</Text>
          <Text style={styles.subtitle}>Controle de ponto seguro e preciso</Text>
        </View>

        {bonds ? (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Você tem mais de um vínculo</Text>
              <Text style={styles.bondHint}>Escolha em qual matrícula deseja entrar:</Text>
            </View>

            {bonds.map((bond) => {
              const selected = selectedBond === bond.registration_number;
              return (
                <Pressable
                  key={bond.registration_number}
                  style={[styles.bondOption, selected && styles.bondOptionSelected]}
                  onPress={() => setSelectedBond(bond.registration_number)}
                >
                  <Text style={[styles.bondLabel, selected && styles.bondLabelSelected]}>
                    {bond.registration_number} · {bond.work_unit ?? 'sem unidade'}
                  </Text>
                  {bond.job_title ? <Text style={styles.bondJob}>{bond.job_title}</Text> : null}
                </Pressable>
              );
            })}

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [styles.submitButton, pressed && styles.submitButtonPressed]}
              disabled={isSubmitting || !selectedBond}
              onPress={handleBondSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.submitLabel}>Entrar</Text>
              )}
            </Pressable>

            <Pressable style={styles.backButton} onPress={handleBackToCredentials} disabled={isSubmitting}>
              <Text style={styles.backLabel}>Voltar</Text>
            </Pressable>
          </View>
        ) : (
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>CPF</Text>
            <TextInput
              value={cpf}
              onChangeText={(value) => setCpf(formatCpf(value))}
              placeholder="000.000.000-00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              autoCorrect={false}
              autoComplete="off"
              maxLength={14}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? (
                  <EyeSlash size={20} color={colors.mutedForeground} weight="bold" />
                ) : (
                  <Eye size={20} color={colors.mutedForeground} weight="bold" />
                )}
              </Pressable>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && styles.submitButtonPressed]}
            disabled={isSubmitting || !cpf || !password}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.submitLabel}>Entrar</Text>
            )}
          </Pressable>

          <Text style={styles.terms}>
            Ao entrar, você concorda com os termos de uso e políticas de privacidade da sua empresa.
          </Text>
        </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 48,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 34,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    height: 56,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: fontFamily.regular,
    color: colors.foreground,
  },
  passwordWrapper: {
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
  },
  error: {
    color: colors.destructive,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitLabel: {
    color: colors.primaryForeground,
    fontFamily: fontFamily.bold,
    fontSize: 17,
  },
  terms: {
    fontSize: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  bondHint: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.foreground,
    marginLeft: 4,
  },
  bondOption: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  bondOptionSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  bondLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.foreground,
  },
  bondLabelSelected: {
    color: colors.primary,
  },
  bondJob: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  backLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: colors.mutedForeground,
  },
});
