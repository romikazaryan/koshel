import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MarketSearchItem } from '../lib/marketSearch';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  placeholder: string;
  selected: MarketSearchItem | null;
  onSelect: (item: MarketSearchItem | null) => void;
  onSearch: (query: string) => Promise<MarketSearchItem[]>;
  disabled?: boolean;
};

export function MarketSearchPicker({
  placeholder,
  selected,
  onSelect,
  onSearch,
  disabled = false,
}: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MarketSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const requestId = useRef(0);

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      wrap: { marginBottom: 10 },
      input: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: c.text,
        backgroundColor: c.backgroundDeep,
      },
      selected: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: c.accent,
        backgroundColor: c.accentSoft,
        borderRadius: radii.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
      },
      selectedText: { flex: 1, marginRight: 8 },
      selectedTitle: { fontSize: 15, fontWeight: '700', color: c.text },
      selectedSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
      clear: { fontSize: 13, fontWeight: '700', color: c.accentDark },
      results: {
        marginTop: 6,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radii.md,
        overflow: 'hidden',
        backgroundColor: c.surface,
      },
      resultRow: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.borderLight,
      },
      resultTitle: { fontSize: 15, fontWeight: '600', color: c.text },
      resultSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
      meta: { fontSize: 12, color: c.textMuted, marginTop: 6 },
      error: { fontSize: 12, color: c.danger, marginTop: 6 },
    })
  );

  useEffect(() => {
    if (selected) {
      setQuery('');
      setResults([]);
      setSearchError('');
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setSearchError('');
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      const current = ++requestId.current;
      setIsSearching(true);
      setSearchError('');

      void onSearch(trimmed)
        .then((items) => {
          if (current !== requestId.current) return;
          setResults(items);
        })
        .catch(() => {
          if (current !== requestId.current) return;
          setResults([]);
          setSearchError('Не удалось загрузить список. Проверьте интернет.');
        })
        .finally(() => {
          if (current !== requestId.current) return;
          setIsSearching(false);
        });
    }, 320);

    return () => clearTimeout(timer);
  }, [onSearch, query, selected]);

  const handleSelect = (item: MarketSearchItem) => {
    onSelect(item);
    setQuery('');
    setResults([]);
    setSearchError('');
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={selected ? '' : query}
        onChangeText={(text) => {
          onSelect(null);
          setQuery(text);
        }}
        editable={!disabled && !selected}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {selected ? (
        <View style={styles.selected}>
          <View style={styles.selectedText}>
            <Text style={styles.selectedTitle}>
              {selected.symbol} · {selected.name}
            </Text>
            {selected.subtitle ? (
              <Text style={styles.selectedSub}>{selected.subtitle}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => onSelect(null)} hitSlop={8}>
            <Text style={styles.clear}>Сбросить</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isSearching ? (
        <View style={styles.meta}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : null}

      {!selected && results.length > 0 ? (
        <View style={styles.results}>
          {results.map((item) => (
            <TouchableOpacity
              key={`${item.unit}-${item.symbol}`}
              style={styles.resultRow}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.resultTitle}>
                {item.symbol} · {item.name}
              </Text>
              {item.subtitle ? <Text style={styles.resultSub}>{item.subtitle}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!selected && !isSearching && query.trim().length >= 1 && results.length === 0 && !searchError ? (
        <Text style={styles.meta}>Ничего не найдено</Text>
      ) : null}

      {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
    </View>
  );
}
