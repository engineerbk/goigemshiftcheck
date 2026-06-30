import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { downloadBinary } from '../../src/csv';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';

type Period = 'all' | 'month' | 'week';

function fmtHours(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Reports() {
  const { t } = useLang();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('all');
  const [data, setData] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadBinary(
        `/admin/reports.xlsx?period=${period}`,
        `shift-report-${period}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } catch (e: any) {
      Alert.alert(t('export_failed'), e?.message || '');
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([api.adminReports(p), api.adminMonthly(6)]);
      setData(r);
      setMonthly(m?.months || []);
    } catch (e) {
      console.log('reports err', e);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(period); }, [load, period]));

  const onRefresh = async () => { setRefreshing(true); await load(period); setRefreshing(false); };

  const rows = (data?.rows || []).filter((r: any) => r.sessions > 0);
  const maxMinutes = rows.length ? Math.max(...rows.map((r: any) => r.total_minutes), 1) : 1;
  const totals = data?.totals;
  const avgPerSession = totals?.completed ? Math.round(totals.total_minutes / totals.completed) : 0;
  const maxMonthly = monthly.length ? Math.max(...monthly.map((m: any) => m.total_minutes), 1) : 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="reports-screen">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>{t('reports_title')}</Text>
        <Text style={styles.sub}>{t('reports_sub')}</Text>

        <View style={styles.toolbar}>
          <View style={styles.pillRow}>
            {(['all', 'month', 'week'] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                testID={`period-${p}`}
                onPress={() => setPeriod(p)}
                style={[styles.pill, period === p && styles.pillActive]}
              >
                <Text style={[styles.pillText, period === p && styles.pillTextActive]}>
                  {p === 'all' ? t('period_all') : p === 'month' ? t('period_month') : t('period_week')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity testID="export-csv" onPress={onExport} disabled={exporting} style={styles.exportBtn}>
            {exporting ? (
              <ActivityIndicator color={colors.primaryFg} size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color={colors.primaryFg} />
                <Text style={styles.exportText}>{t('export_csv')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.statAccent]}>
                <Ionicons name="time" size={18} color={colors.primaryFg} />
                <Text style={styles.statValueAccent}>{totals?.total_hours ?? 0}h</Text>
                <Text style={styles.statLabelAccent}>{t('total_hours_all')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="people" size={18} color={colors.primary} />
                <Text style={styles.statValue}>{totals?.employees_with_activity ?? 0}</Text>
                <Text style={styles.statLabel}>{t('total_employees_active')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="hourglass" size={18} color={colors.primary} />
                <Text style={styles.statValue}>{fmtHours(avgPerSession)}</Text>
                <Text style={styles.statLabel}>{t('avg_per_session')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={styles.statValue}>{totals?.completed ?? 0}</Text>
                <Text style={styles.statLabel}>{t('completed')}</Text>
              </View>
            </View>

            {monthly.length > 0 && (
              <View style={styles.monthlyCard}>
                <Text style={styles.monthlyTitle}>{t('monthly_breakdown')}</Text>
                <Text style={styles.monthlySub}>{t('monthly_sub')}</Text>
                <View style={styles.monthlyRow}>
                  {monthly.map((m: any) => {
                    const h = Math.max(8, Math.round((m.total_minutes / maxMonthly) * 110));
                    return (
                      <View key={m.label} style={styles.monthCol} testID={`month-${m.year}-${m.month}`}>
                        <Text style={styles.monthVal}>{m.total_hours}h</Text>
                        <View style={[styles.monthBar, { height: h }]} />
                        <Text style={styles.monthLabel}>{m.label.split(' ')[0]}</Text>
                        <Text style={styles.monthYear}>{m.label.split(' ')[1]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {rows.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="bar-chart-outline" size={40} color={colors.textLight} />
                <Text style={styles.emptyText}>{t('no_report_data')}</Text>
              </View>
            ) : (
              rows.map((r: any, idx: number) => {
                const pct = Math.max(4, Math.round((r.total_minutes / maxMinutes) * 100));
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.row}
                    testID={`report-row-${r.id}`}
                    onPress={() => router.push({ pathname: '/employee-report/[userId]', params: { userId: r.id, period } })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowHeader}>
                      <View style={styles.rank}>
                        <Text style={styles.rankText}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{r.name || r.email}</Text>
                        <Text style={styles.rowSub}>{r.email}</Text>
                      </View>
                      <Text style={styles.rowHours}>{r.total_hours}h</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                    </View>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${pct}%` }]} />
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>{r.sessions} {t('sessions_label')}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.meta}>{r.completed} {t('completed').toLowerCase()}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.meta}>{t('last_seen')}: {fmtDate(r.last_check_in)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 16 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, minHeight: 38,
  },
  exportText: { color: colors.primaryFg, fontWeight: '700', fontSize: 13 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.textMain, fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: colors.primaryFg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  statCard: {
    width: '48%', backgroundColor: colors.background, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  statAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5, marginTop: 4 },
  statLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  statValueAccent: { fontSize: 22, fontWeight: '800', color: colors.primaryFg, letterSpacing: -0.5, marginTop: 4 },
  statLabelAccent: { fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  row: { backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  rankText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowHours: { fontSize: 18, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  barBg: { height: 8, borderRadius: 4, backgroundColor: colors.secondary, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 10 },
  meta: { fontSize: 11, color: colors.textMuted },
  metaDot: { fontSize: 11, color: colors.textLight },
  monthlyCard: { backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 18 },
  monthlyTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  monthlySub: { fontSize: 11, color: colors.textMuted, marginTop: 2, marginBottom: 14 },
  monthlyRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 150, gap: 6 },
  monthCol: { alignItems: 'center', flex: 1, minWidth: 36 },
  monthBar: { width: 22, borderRadius: 6, backgroundColor: colors.primary },
  monthVal: { fontSize: 10, fontWeight: '700', color: colors.textMain, marginBottom: 4 },
  monthLabel: { fontSize: 10, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  monthYear: { fontSize: 9, color: colors.textLight },
});
