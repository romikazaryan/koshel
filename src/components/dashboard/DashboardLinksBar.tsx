import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  capitalTotal: number;
  onImportStatement: () => void;
  onOpenCapital: () => void;
  onOpenImports: () => void;
};

const ACTIONS = [
  { key: 'import', icon: 'document-text-outline', label: 'Выписка', hint: 'CSV · PDF' },
  { key: 'capital', icon: 'trending-up-outline', label: 'Капитал', hint: 'активы' },
  { key: 'imports', icon: 'time-outline', label: 'Импорты', hint: 'история' },
] as const;

export function DashboardLinksBar({
  capitalTotal,
  onImportStatement,
  onOpenCapital,
  onOpenImports,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      row: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
      },
      tile: {
        flex: 1,
        backgroundColor: c.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: c.borderLight,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        ...shadows.soft,
      },
      iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.accentSoft,
        marginBottom: 7,
      },
      label: {
        fontSize: 12,
        fontWeight: '800',
        color: c.text,
        marginBottom: 2,
      },
      hint: {
        fontSize: 10,
        fontWeight: '600',
        color: c.textMuted,
        textAlign: 'center',
      },
      capitalValue: {
        fontSize: 11,
        fontWeight: '800',
        color: c.accentDark,
        marginTop: 1,
        fontVariant: ['tabular-nums'],
      },
    })
  );

  const handlers = {
    import: onImportStatement,
    capital: onOpenCapital,
    imports: onOpenImports,
  };

  return (
    <View style={styles.row}>
      {ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={styles.tile}
          onPress={handlers[action.key]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <View style={styles.iconBadge}>
            <Ionicons name={action.icon} size={19} color={colors.accent} />
          </View>
          <Text style={styles.label}>{action.label}</Text>
          {action.key === 'capital' ? (
            <Text style={styles.capitalValue}>₽{capitalTotal.toLocaleString('ru-RU')}</Text>
          ) : (
            <Text style={styles.hint}>{action.hint}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
