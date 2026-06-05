import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeStackParamList } from '../navigation/types';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'Recommendations'>;

export function RecommendationsScreen(_props: Props) {
  const route = useRoute();
  const navigation = useNavigation();
  const recommendations: string =
    (route.params as HomeStackParamList['Recommendations'] | undefined)?.recommendations ?? '';

  const styles = useThemedStyles(({ colors }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: colors.background },
      container: { flex: 1 },
      contentContainer: { padding: 20, paddingBottom: 40 },
      backButton: { marginBottom: 12 },
      backText: { color: colors.accentDark, fontWeight: '600', fontSize: 16 },
      headerWrap: { marginBottom: 14 },
      title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 6 },
      subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
      card: {
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: colors.border,
      },
      text: { color: colors.text, fontSize: 15, lineHeight: 24 },
    })
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>

        <View style={styles.headerWrap}>
          <Text style={styles.title}>Рекомендации</Text>
          <Text style={styles.subtitle}>Безопасные сценарии для свободных денег</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.text}>
            {recommendations || 'Здесь появятся рекомендации после анализа.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
