import * as Location from 'expo-location';

export type Coordinates = { latitude: number; longitude: number } | null;

/**
 * Tenta obter a localização atual em até 5s. Nunca lança erro — se a permissão for
 * negada, o GPS estiver desligado, ou o timeout estourar, retorna null e a marcação
 * de ponto segue sem coordenadas (o backend já aceita latitude/longitude nulos).
 */
export async function getCurrentCoordinates(): Promise<Coordinates> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (!result) return null;

    return { latitude: result.coords.latitude, longitude: result.coords.longitude };
  } catch {
    return null;
  }
}

export async function reverseGeocode(coords: { latitude: number; longitude: number }): Promise<string | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync(coords);
    if (!address) return null;
    const parts = [address.street, address.streetNumber].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : address.name ?? null;
  } catch {
    return null;
  }
}
