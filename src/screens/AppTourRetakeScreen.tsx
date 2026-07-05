import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppTourScreen } from './AppTourScreen';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AppTour'>;

export function AppTourRetakeScreen({ navigation }: Props) {
  return (
    <AppTourScreen
      mode="retake"
      onComplete={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}
