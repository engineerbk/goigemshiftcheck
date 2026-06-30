import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../src/api';
import { downloadCsv } from '../../src/csv';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';

type Period = 'all' | 'month' | 'week';

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}
function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDay(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function EmployeeReport() {
  const { userId, period: initialPeriod } = useLocalSearchParams<{ userId: string; period?: string }>();
  const router = useRouter();
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>(((initialPeriod as Period) || 'all'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    if (!userId) return;
    setExporting(true);
    try {
      const safe = (data?.employee?.email || userId).split('@')[0];
      await downloadCsv(
        `/admin/reports/${userId}/export.csv?period=${period}`,
        `shift-${safe}-${period}.csv`,
      );
    } catch (e: any) {
      Alert.alert(t('export_failed'), e?.message || '');
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(async (p: Period) => {
    if (!userId) return;
    setLoading(true);
    try {
      const r = await api.adminEmployeeReport(userId, p);
      setData(r);
    } catch (e: any) {
      console.log('emp report err', e?.message);
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(period); }, [load, period]));

  const onRefresh = async () => { setRefreshing(true); await load(period); setRefreshing(false); };

  const totals = data?.totals;
  const sessions = data?.sessions || [];
  const shifts = data?.shifts || [];
  const daily = data?.daily || [];
  const maxDay = daily.length ? Math.max(...daily.map((d: any) => d.minutes), 1) : 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="employee-report-screen">
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('employee_detail')}</Text>
        <TouchableOpacity onPress={onExport} disabled={exporting || !data} style={styles.exportTopBtn} testID="export-employee-csv">
          {exporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="download-outline" size={22} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading || !data ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.headerCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(data.employee.name || data.employee.email).charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.empName}>{data.employee.name || data.employee.email}</Text>
              <Text style={styles.empEmail}>{data.employee.email}</Text>
              <View style={styles.roleBadge}><Text style={styles.roleText}>{data.employee.role.toUpperCase()}</Text></View>
            </View>

            <View style={styles.pillRow}>
              {(['all', 'month', 'week'] as Period[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  testID={`emp-period-${p}`}
                  onPress={() => setPeriod(p)}
                  style={[styles.pill, period === p && styles.pillActive]}
                >
                  <Text style={[styles.pillText, period === p && styles.pillTextActive]}>
                    {p === 'all' ? t('period_all') : p === 'month' ? t('period_month') : t('period_week')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.statAccent]}>
                <Ionicons name="time" size={18} color={colors.primaryFg} />
                <Text style={styles.statValueAccent}>{totals.total_hours}h</Text>
                <Text style={styles.statLabelAccent}>{t('total_hours_all')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="repeat" size={18} color={colors.primary} />
                <Text style={styles.statValue}>{totals.sessions}</Text>
                <Text style={styles.statLabel}>{t('sessions')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={styles.statValue}>{totals.completed}</Text>
                <Text style={styles.statLabel}>{t('completed')}</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="hourglass" size={18} color={colors.primary} />
                <Text style={styles.statValue}>{fmtMin(totals.avg_minutes)}</Text>
                <Text style={styles.statLabel}>{t('avg_per_session')}</Text>
              </View>
            </View>

            {daily.length > 0 && (
              <>
                <Text style={styles.section}>{t('daily_breakdown')}</Text>
                <View style={styles.chartCard}>
                  <View style={styles.chartRow}>
                    {daily.map((d: any) => {
                      const h = Math.max(6, Math.round((d.minutes / maxDay) * 110));
                      return (
                        <View key={d.date} style={styles.barCol}>
                          <Text style={styles.barVal}>{(d.minutes / 60).toFixed(1)}</Text>
                          <View style={[styles.bar, { height: h }]} />
                          <Text style={styles.barLabel}>{fmtDay(d.date)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            <Text style={styles.section}>{t('all_sessions')} ({sessions.length})</Text>
            {sessions.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>{t('no_sessions')}</Text></View>
            ) : (
              sessions.map((s: any) => (
                <View key={s.id} style={styles.sessionRow} testID={`session-${s.id}`}>
                  <View style={[styles.dot, { backgroundColor: s.check_out ? colors.success : colors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionTitle}>
                      {new Date(s.check_in).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.sessionTime}>
                      {t('in')} {fmtTime(s.check_in)}  •  {t('out')} {fmtTime(s.check_out)}
                    </Text>
                    {s.check_in_address ? (
                      <Text style={styles.sessionLoc} numberOfLines={2}>
                        <Ionicons name="location" size={11} color={colors.textLight} /> {s.check_in_address}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.dur}>
                    <Text style={styles.durText}>
                      {s.duration_minutes != null ? fmtMin(s.duration_minutes) : t('active')}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <Text style={styles.section}>{t('registered_shifts')} ({shifts.length})</Text>
            {shifts.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>{t('no_shifts_registered')}</Text></View>
            ) : (
              shifts.map((s: any) => (
                <View key={s.id} style={styles.sessionRow} testID={`shift-${s.id}`}>
                  <Ionicons name="calendar-outline" size={22} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 4 }}>
                    <Text style={styles.sessionTitle}>{s.date}</Text>
                    <Text style={styles.sessionTime}>{s.start_time} – {s.end_time}{s.note ? `  •  ${s.note}` : ''}</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  exportTopBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textMain },
  container: { padding: 20, paddingBottom: 50 },
  headerCard: {
    backgroundColor: colors.background, borderRadius: 20, padding: 22, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: colors.primaryFg, fontWeight: '800', fontSize: 26 },
  empName: { fontSize: 20, fontWeight: '800', color: colors.textMain },
  empEmail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  roleBadge: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#EFF6FF', borderRadius: 999 },
  roleText: { color: colors.primary, fontWeight: '700', fontSize: 10, letterSpacing: 1 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.textMain, fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: colors.primaryFg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: { width: '48%', backgroundColor: colors.background, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 4 },
  statAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5, marginTop: 4 },
  statLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  statValueAccent: { fontSize: 22, fontWeight: '800', color: colors.primaryFg, letterSpacing: -0.5, marginTop: 4 },
  statLabelAccent: { fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  section: { marginTop: 22, marginBottom: 10, fontSize: 17, fontWeight: '700', color: colors.textMain },
  chartCard: { backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 150, gap: 4 },
  barCol: { alignItems: 'center', flex: 1, minWidth: 24 },
  bar: { width: 16, borderRadius: 4, backgroundColor: colors.primary },
  barVal: { fontSize: 10, color: colors.textMuted, marginBottom: 4, fontWeight: '600' },
  barLabel: { fontSize: 9, color: colors.textLight, marginTop: 6, transform: [{ rotate: '-30deg' }] },
  empty: { padding: 22, alignItems: 'center', backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textMuted },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background,
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sessionTitle: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  sessionTime: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sessionLoc: { fontSize: 11, color: colors.textLight, marginTop: 4 },
  dur: { backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  durText: { fontSize: 12, fontWeight: '700', color: colors.textMain },
});
