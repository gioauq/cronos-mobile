import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WifiSlash } from 'phosphor-react-native';
import { colors, fontFamily } from '../theme';

export function OfflineBanner() {
  return (
    <View style={styles.container}>
      <WifiSlash size={16} color={colors.secondaryForeground} weight="bold" />
      <Text style={styles.text}>Modo offline. Batidas serão sincronizadas depois.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: colors.secondaryForeground,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },
});
