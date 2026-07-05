import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_KEY_PREFIX = 'koshel_app_tour_v1';
const LOCAL_DEVICE_KEY = 'koshel_app_tour_device_v1';

function localKey(userId: string) {
  return `${LOCAL_KEY_PREFIX}:${userId}`;
}

export async function fetchAppTourCompleted(userId?: string | null): Promise<boolean> {
  if (userId) {
    const local = await AsyncStorage.getItem(localKey(userId));
    if (local === '1') return true;
  } else {
    const local = await AsyncStorage.getItem(LOCAL_DEVICE_KEY);
    if (local === '1') return true;
  }
  return false;
}

export async function completeAppTour(userId?: string | null): Promise<void> {
  if (userId) {
    await AsyncStorage.setItem(localKey(userId), '1');
  } else {
    await AsyncStorage.setItem(LOCAL_DEVICE_KEY, '1');
  }
}
