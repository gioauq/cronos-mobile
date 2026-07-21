import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from '../api/profile';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Pede permissão de notificação e registra o token Expo do dispositivo no backend.
 * Falha silenciosamente (sem interromper o app) se o usuário negar a permissão ou se
 * o app ainda não estiver vinculado a um projeto EAS (extra.eas.projectId em app.json —
 * necessário para gerar um token Expo Push real; configure com `eas init`).
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      return;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(tokenResponse.data);
  } catch {
    // Falha ao registrar push não deve impedir o uso do app.
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    await registerPushToken(null);
  } catch {
    // Se o dispositivo estiver offline no momento do logout, não há o que fazer aqui.
  }
}
