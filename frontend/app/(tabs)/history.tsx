import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/api';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function History() {
  const { t } = useLang();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.myAttendance();
      setRecords(list);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalMinutes = records.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const completed = records.filter(r => r.check_out).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="history-screen">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>{t('work_history')}</Text>
        <Text style={styles.sub}>{t('work_history_sub')}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalHours}h</Text>
            <Text style={styles.statLabel}>{t('total_hours')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completed}</Text>
            <Text style={styles.statLabel}>{t('completed')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{records.length}</Text>
            <Text style={styles.statLabel}>{t('sessions')}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : records.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="hourglass-outline" size={40} color={colors.textLight} />
            <Text style={styles.emptyText}>{t('no_history')}</Text>
            <Text style={styles.emptyHint}>{t('no_history_hint')}</Text>
          </View>
        ) : (
          records.map((r) => (
            <View key={r.id} style={styles.item} testID={`history-item-${r.id}`}>
              <View style={[styles.dot, { backgroundColor: r.check_out ? colors.success : colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemDate}>{fmtDate(r.check_in)}</Text>
                <Text style={styles.itemTime}>{t('in')} {fmtTime(r.check_in)}  •  {t('out')} {fmtTime(r.check_out)}</Text>
                {(r.late_minutes != null && r.late_minutes > 0) || (r.early_leave_minutes != null && r.early_leave_minutes > 0) ? (
                  <View style={styles.badgeRow}>
                    {r.late_minutes != null && r.late_minutes > 0 ? (
                      <View style={styles.lateChip}>
                        <Ionicons name="warning" size={10} color={colors.error} />
                        <Text style={styles.lateChipText}>{t('late')} {r.late_minutes}{t('minutes_short')}</Text>
                      </View>
                    ) : null}
                    {r.early_leave_minutes != null && r.early_leave_minutes > 0 ? (
                      <View style={styles.earlyChip}>
                        <Ionicons name="alert-circle" size={10} color={colors.warning} />
                        <Text style={styles.earlyChipText}>{t('early_leave')} {r.early_leave_minutes}{t('minutes_short')}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {(r.check_in_address || r.check_in_lat) ? (
                  <Text style={styles.itemLoc} numberOfLines={2}>
                    <Ionicons name="location" size={11} color={colors.textLight} />
                    {' '}
                    {r.check_in_address || `${r.check_in_lat?.toFixed(4)}, ${r.check_in_lng?.toFixed(4)}`}
                  </Text>
                ) : null}
              </View>
              <View style={styles.dur}>
                <Text style={styles.durText}>
                  {r.duration_minutes != null
                    ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m`
                    : t('active')}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: colors.background, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textMain },
  emptyHint: { fontSize: 13, color: colors.textMuted },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background,
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemDate: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  itemTime: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  itemLoc: { fontSize: 11, color: colors.textLight, marginTop: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  lateChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  lateChipText: { fontSize: 10, fontWeight: '700', color: colors.error },
  earlyChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  earlyChipText: { fontSize: 10, fontWeight: '700', color: colors.warning },
  dur: { backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  durText: { fontSize: 12, fontWeight: '700', color: colors.textMain },
});
