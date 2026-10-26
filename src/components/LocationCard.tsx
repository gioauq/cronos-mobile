import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CheckCircle, MapPin } from 'phosphor-react-native';
import { colors, fontFamily, radius } from '../theme';

type Props = {
  isLoading: boolean;
  address: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  /** Degrau atual da escada de localização ("Ligando o GPS…"), pra espera não parecer travamento. */
  statusLabel?: string | null;
};

export function LocationCard({ isLoading, address, coordinates, statusLabel }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.thumbnail}>
        <MapPin size={24} color={colors.accent} weight="fill" />
      </View>
      <View style={styles.info}>
        {isLoading ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={styles.statusTextMuted}>{statusLabel ?? 'Obtendo localização…'}</Text>
          </View>
        ) : coordinates ? (
          <>
            <View style={styles.statusRow}>
              <CheckCircle size={14} color={colors.accent} weight="fill" />
              <Text style={styles.statusTextAccent}>LOCALIZAÇÃO OBTIDA</Text>
            </View>
            <Text style={styles.address} numberOfLines={1}>
              {address ?? 'Endereço não identificado'}
            </Text>
            <Text style={styles.coords} numberOfLines={1}>
              {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
            </Text>
          </>
        ) : (
          <Text style={styles.statusTextMuted}>Aguardando sinal do GPS…</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    width: '100%',
    maxWidth: 380,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTextAccent: {
    color: colors.accent,
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusTextMuted: {
    color: colors.mutedForeground,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
  address: {
    color: colors.foreground,
    fontFamily: fontFamily.medium,
    fontSize: 14,
  },
  coords: {
    color: colors.mutedForeground,
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
});
