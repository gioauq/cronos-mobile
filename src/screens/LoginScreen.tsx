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
import { useAuth } from '../context/AuthContext';
import { useAsyncAction } from '../hooks/useAsyncAction';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { run: submit, isLoading: isSubmitting } = useAsyncAction(
    (emailValue: string, passwordValue: string) => signIn(emailValue, passwordValue),
    (err: any) => {
      const message = err?.response?.data?.errors?.email?.[0] ?? 'Não foi possível entrar. Verifique suas credenciais e a conexão.';
      setError(message);
    }
  );

  const handleSubmit = () => {
    setError(null);
    submit(email.trim(), password);
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

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>E-mail corporativo</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="nome.sobrenome@empresa.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
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
            disabled={isSubmitting || !email || !password}
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
});
