import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCapitalAssetTypeLabel } from '../../constants/capitalTypes';
import { formatQuantityLabel } from '../../lib/capitalValuation';
import { getMarketAssetDisplay } from '../../lib/capitalAssetDisplay';
import type { AssetValuation } from '../../lib/capitalValuation';
import type { CapitalAsset } from '../../types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useCapitalCurrency } from '../../contexts/CapitalCurrencyContext';
import { moneyText } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  item: CapitalAsset;
  valuation?: AssetValuation;
  isLast?: boolean;
  onPress: () => void;
};

function assetIcon(type: CapitalAsset['assetType']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'stocks':
      return 'trending-up';
    case 'bonds':
      return 'document-text-outline';
    case 'crypto':
      return 'logo-bitcoin';
    case 'cash':
      return 'cash-outline';
    case 'deposit':
      return 'wallet-outline';
    case 'real_estate':
      return 'home-outline';
    default:
      return 'layers-outline';
  }
}

export function CapitalManualAssetRow({ item, valuation, isLast = false, onPress }: Props) {
  const { colors } = useAppTheme();
  const { format, cycle } = useCapitalCurrency();
  const displayRub = valuation?.valueRub ?? item.amount;
  const { title, sourceLabel } = getMarketAssetDisplay(item);
  const isLive =
    item.valuationMode === 'market' || (item.assetType === 'cash' && item.quantity && item.unit);
  const qtyLine =
    isLive && item.unit && item.quantity
      ? formatQuantityLabel(item.quantity, item.unit)
      : getCapitalAssetTypeLabel(item.assetType);

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        paddingHorizontal: 14,
        gap: 11,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: c.borderLight,
        opacity: item.isActive ? 1 : 0.42,
      },
      iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: c.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      },
      main: { flex: 1, minWidth: 0 },
      title: {
        fontSize: 15,
        fontWeight: '700',
        color: c.text,
        letterSpacing: -0.2,
      },
      meta: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '500',
        color: c.textMuted,
      },
      right: { alignItems: 'flex-end', maxWidth: '40%' },
      value: {
        fontSize: 15,
        fontWeight: '800',
        color: c.text,
        ...moneyText,
      },
      hidden: {
        marginTop: 2,
        fontSize: 10,
        fontWeight: '700',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      },
    })
  );

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.65}>
      <View style={styles.iconWrap}>
        <Ionicons name={assetIcon(item.assetType)} size={16} color={colors.accentDark} />
      </View>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {sourceLabel ? `${sourceLabel} · ${qtyLine}` : qtyLine}
        </Text>
      </View>
      <View style={styles.right}>
        <TouchableOpacity
          onPress={cycle}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Нажмите, чтобы сменить валюту"
        >
          <Text style={styles.value} numberOfLines={1}>
            {format(displayRub)}
          </Text>
        </TouchableOpacity>
        {!item.isActive ? <Text style={styles.hidden}>скрыт</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
