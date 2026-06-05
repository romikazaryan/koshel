import Constants from 'expo-constants';

const appConstants = Constants.expoConfig || Constants.manifest || {};
const extra = (appConstants as any).extra || {};

export const YANDEX_API_KEY = String(extra.YANDEX_API_KEY ?? '');
export const YANDEX_VISION_API_KEY = String(extra.YANDEX_VISION_API_KEY ?? '');

export const getYandexHeaders = () => ({
  Authorization: `Bearer ${YANDEX_API_KEY}`,
  'Content-Type': 'application/json',
});
