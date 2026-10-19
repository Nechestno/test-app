import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MATCHES_URL } from '../config';
import { UpdatedAgo } from '../components/UpdatedAgo';

// ---------- типы ----------

type Team = { id: string; name: string; city: string };
type Score = { home: number; away: number };

type MatchStatus = 'finished' | 'live' | 'scheduled' | 'postponed';

type Match = {
  id: string;
  startsAt: string | null;
  status: MatchStatus;
  minute?: number;
  home: Team;
  away: Team;
  score: Score | null;
};

type MatchesResponse = { round: number; matches: Match[] };

type Filter = 'all' | 'upcoming' | 'finished';

// ---------- утилиты ----------

const STATUS_LABEL: Record<MatchStatus, string> = {
  finished: 'Завершён',
  live: 'В эфире',
  scheduled: 'Запланирован',
  postponed: 'Перенесён',
};

function formatStartsAt(iso: string | null): string {
  if (!iso) return 'Дата уточняется';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Дата уточняется';
  // Часовой пояс устройства по умолчанию
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Во «Все» показываем всё.
// В «Предстоящие» — только scheduled (у postponed нет даты — не предстоит, а отложен).
// В «Завершённые» — только finished (live ещё не завершён, postponed не состоялся).
function matchesFilter(match: Match, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'upcoming') return match.status === 'scheduled';
  return match.status === 'finished';
}

// ---------- компоненты ----------

function MatchCard({ match }: { match: Match }) {
  const statusLabel = STATUS_LABEL[match.status] ?? match.status;
  const isLive = match.status === 'live';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.teams} numberOfLines={2}>
          {match.home.name} — {match.away.name}
        </Text>
        {match.score ? (
          <Text style={[styles.score, isLive && styles.scoreLive]}>
            {match.score.home}:{match.score.away}
          </Text>
        ) : (
          <Text style={styles.scorePlaceholder}>—</Text>
        )}
      </View>

      <Text style={styles.date}>{formatStartsAt(match.startsAt)}</Text>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.badge,
            match.status === 'finished' && styles.badgeFinished,
            isLive && styles.badgeLive,
            match.status === 'postponed' && styles.badgePostponed,
          ]}
        >
          <Text style={styles.badgeText}>
            {statusLabel}
            {isLive && typeof match.minute === 'number'
              ? ` · ${match.minute}'`
              : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

function FilterBar({
  value,
  onChange,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
}) {
  const options: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'upcoming', label: 'Предстоящие' },
    { key: 'finished', label: 'Завершённые' },
  ];
  return (
    <View style={styles.filterBar}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.filterChip, active && styles.filterChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.filterChipText,
                active && styles.filterChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- экран ----------

export function MatchesScreen() {
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    const requestId = ++requestIdRef.current;

    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(MATCHES_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MatchesResponse = await res.json();

      // защита от устаревших ответов (например, «Повторить» поверх refresh)
      if (requestId !== requestIdRef.current) return;

      const matches = Array.isArray(json?.matches) ? json.matches : [];
      setData({ round: json.round, matches });
      setLastUpdated(Date.now());
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setError(
        e instanceof Error && e.message.startsWith('HTTP')
          ? `Сервер ответил ошибкой (${e.message}). Попробуйте позже.`
          : 'Не удалось загрузить матчи. Проверьте подключение к сети.'
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load('initial');
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.matches.filter((m) => matchesFilter(m, filter));
  }, [data, filter]);

  // --- состояния экрана ---

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Загружаем матчи…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Ошибка загрузки</Text>
        <Text style={styles.muted}>{error}</Text>
        <Pressable
          onPress={() => load('initial')}
          style={styles.retryButton}
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  const total = data?.matches.length ?? 0;

  // Совсем нет матчей в ответе — отдельный пустой экран без фильтров
  if (total === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Матчи тура</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Матчей пока нет</Text>
          <Text style={styles.muted}>
            Как только появятся игры тура, они появятся здесь.
          </Text>
          <Pressable
            onPress={() => load('initial')}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Обновить</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Матчи тура</Text>

      <FilterBar value={filter} onChange={setFilter} />

      {lastUpdated !== null && (
        <View style={styles.updatedRow}>
          <UpdatedAgo since={lastUpdated} />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MatchCard match={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Нет матчей в этой категории</Text>
            <Text style={styles.muted}>
              Попробуйте другой фильтр или потяните вниз, чтобы обновить.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// ---------- стили ----------

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },

  filterBar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#eef0f3',
  },
  filterChipActive: { backgroundColor: '#1e63d0' },
  filterChipText: { fontSize: 14, color: '#1a1a1a' },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },

  updatedRow: { marginBottom: 8 },

  listContent: { paddingBottom: 24 },
  separator: { height: 8 },

  card: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8dbe0',
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  teams: { flex: 1, fontSize: 16, fontWeight: '600' },
  score: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scoreLive: { color: '#c0392b' },
  scorePlaceholder: { fontSize: 20, fontWeight: '700', color: '#9aa0a6' },
  date: { fontSize: 13, color: '#5f6368' },

  statusRow: { flexDirection: 'row' },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#e6efff',
  },
  badgeFinished: { backgroundColor: '#e9ecef' },
  badgeLive: { backgroundColor: '#fdecea' },
  badgePostponed: { backgroundColor: '#fff4e5' },
  badgeText: { fontSize: 12, color: '#1a1a1a' },

  emptyBox: { paddingVertical: 24, gap: 8, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600' },

  muted: { fontSize: 14, color: '#5f6368', textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '700' },

  retryButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#1e63d0',
  },
  retryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});