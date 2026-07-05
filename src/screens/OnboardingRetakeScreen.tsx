import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingScreen } from './OnboardingScreen';
import { useAuth } from '../contexts/AuthContext';
import { fetchOnboardingAnswers } from '../lib/onboarding';
import type { ProfileStackParamList } from '../navigation/types';
import type { OnboardingAnswers } from '../types/onboarding';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Onboarding'>;

export function OnboardingRetakeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [initialAnswers, setInitialAnswers] = useState<OnboardingAnswers | null>(null);

  const styles = useThemedStyles(() =>
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: 'transparent' },
      loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    })
  );

  useEffect(() => {
    let cancelled = false;
    void fetchOnboardingAnswers(user?.id).then((answers) => {
      if (!cancelled) setInitialAnswers(answers);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (initialAnswers == null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <OnboardingScreen
      mode="retake"
      initialAnswers={initialAnswers}
      onComplete={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}
