import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FingerprintSimple } from 'phosphor-react-native';
import { colors, fontFamily, radius } from '../theme';

type Props = {
  label: string;
  disabled?: boolean;
  isSubmitting: boolean;
  onPress: () => void;
};

export function PunchButton({ label, disabled, isSubmitting, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isSubmitting}
      // O botão é um círculo com ícone e um rótulo curto ("Entrada", "Saída"): sem estes
      // atributos o leitor de tela anuncia só a palavra solta, sem dizer que é o botão de
      // registrar o ponto nem que ele está processando.
      accessibilityRole="button"
      accessibilityLabel={`Registrar ${label}`}
      accessibilityHint="Tira a selfie, captura a localização e registra sua marcação de ponto"
      accessibilityState={{ disabled: disabled || isSubmitting, busy: isSubmitting }}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      {isSubmitting ? (
        <ActivityIndicator size="large" color={colors.accentForeground} />
      ) : (
        <>
          <FingerprintSimple size={64} color={colors.accentForeground} weight="bold" />
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const SIZE = 256;

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  label: {
    color: colors.accentForeground,
    fontFamily: fontFamily.bold,
    fontSize: 22,
  },
});
