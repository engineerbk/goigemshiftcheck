import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';
import NotificationBell from '../../src/components/NotificationBell';

function fmtDt(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function Admin() {
  const { t } = useLang();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [pendingSwaps, setPendingSwaps] = useState<number>(0);
  const [pendingShifts, setPendingShifts] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, e, a, sh, sw, ps] = await Promise.all([
        api.adminStats(), api.adminEmployees(), api.adminAttendance(), api.adminShifts(), api.adminListSwaps(), api.adminPendingShifts(),
      ]);
      setStats(s); setEmployees(e); setAttendance(a); setShifts(sh);
      setPendingSwaps((sw || []).filter((x: any) => x.status === 'pending').length);
      setPendingShifts((ps || []).length);
    } catch (err) {
      console.log('admin load err', err);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="admin-screen">
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('admin_dashboard')}</Text>
            <Text style={styles.sub}>{t('admin_sub')}</Text>
          </View>
          <NotificationBell />
        </View>

        <TouchableOpacity
          testID="admin-approvals-link"
          style={[styles.swapCta, styles.approveCta]}
          onPress={() => router.push('/admin-approvals')}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-done-circle" size={20} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.approveCtaTitle}>{t('pending_shifts')}</Text>
            <Text style={styles.approveCtaSub}>
              {pendingShifts > 0 ? `${pendingShifts} ${t('pending_approval').toLowerCase()}` : t('no_pending_shifts')}
            </Text>
          </View>
          {pendingShifts > 0 && (
            <View style={styles.approveBadge}>
              <Text style={styles.approveBadgeText}>{pendingShifts}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#92400E" />
        </TouchableOpacity>

        <TouchableOpacity
          testID="admin-swaps-link"
          style={styles.swapCta}
          onPress={() => router.push('/admin-swaps')}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.primaryFg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.swapCtaTitle}>{t('swap_requests_admin')}</Text>
            <Text style={styles.swapCtaSub}>
              {pendingSwaps > 0 ? `${pendingSwaps} ${t('pending')}` : t('no_swaps_pending')}
            </Text>
          </View>
          {pendingSwaps > 0 && (
            <View style={styles.swapBadge}>
              <Text style={styles.swapBadgeText}>{pendingSwaps}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.primaryFg} />
        </TouchableOpacity>

        <View style={styles.statsGrid}>
          <StatCard icon="people" label={t('employees')} value={stats?.total_employees ?? 0} />
          <StatCard icon="pulse" label={t('active_now')} value={stats?.active_now ?? 0} accent />
          <StatCard icon="calendar" label={t('shifts_today')} value={stats?.shifts_today ?? 0} />
          <StatCard icon="time" label={t('total_shifts')} value={stats?.total_shifts ?? 0} />
        </View>

        <Text style={styles.sectionTitle}>{t('live_activity')}</Text>
        {attendance.slice(0, 8).map((r) => (
          <View key={r.id} style={styles.row} testID={`admin-attendance-${r.id}`}>
            <View style={[styles.dot, { backgroundColor: r.check_out ? colors.textLight : colors.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.user_name || r.user_email}</Text>
              <Text style={styles.rowSub}>{t('in')} {fmtDt(r.check_in)} • {t('out')} {fmtDt(r.check_out)}</Text>
              {r.check_in_address ? (
                <Text style={styles.rowSub} numberOfLines={2}>
                  <Ionicons name="location" size={11} color={colors.textLight} /> {r.check_in_address}
                </Text>
              ) : null}
            </View>
            <Text style={styles.badge}>
              {r.duration_minutes != null ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m` : t('active')}
            </Text>
          </View>
        ))}
        {attendance.length === 0 && <EmptyBox text={t('no_attendance')} />}

        <Text style={styles.sectionTitle}>{t('employees')} ({employees.length})</Text>
        {employees.map((u) => (
          <View key={u.id} style={styles.row} testID={`admin-employee-${u.id}`}>
            <View style={styles.miniAvatar}>
              <Text style={styles.miniAvatarText}>{(u.name || u.email).charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{u.name || '—'}</Text>
              <Text style={styles.rowSub}>{u.email}</Text>
            </View>
            <View style={[styles.roleTag, u.role === 'admin' && styles.roleTagAdmin]}>
              <Text style={[styles.roleTagText, u.role === 'admin' && styles.roleTagTextAdmin]}>{u.role}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>{t('upcoming_shifts')}</Text>
        {shifts.slice(0, 10).map((s) => (
          <View key={s.id} style={styles.row} testID={`admin-shift-${s.id}`}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{s.user_name || s.user_email}</Text>
              <Text style={styles.rowSub}>{s.date}  •  {s.start_time}–{s.end_time}</Text>
            </View>
          </View>
        ))}
        {shifts.length === 0 && <EmptyBox text={t('no_shifts_registered')} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, accent }: any) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Ionicons name={icon} size={18} color={accent ? colors.primaryFg : colors.primary} />
      <Text style={[styles.statValue, accent && { color: colors.primaryFg }]}>{value}</Text>
      <Text style={[styles.statLabel, accent && { color: 'rgba(255,255,255,0.8)' }]}>{label}</Text>
    </View>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  swapCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primary, borderRadius: 16, padding: 14, marginBottom: 16,
  },
  swapCtaTitle: { color: colors.primaryFg, fontSize: 14, fontWeight: '700' },
  swapCtaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  swapBadge: { backgroundColor: '#fff', minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  swapBadgeText: { color: colors.primary, fontWeight: '800', fontSize: 11 },
  approveCta: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
  approveCtaTitle: { color: '#92400E', fontSize: 14, fontWeight: '700' },
  approveCtaSub: { color: '#92400E', fontSize: 12, marginTop: 2, opacity: 0.85 },
  approveBadge: { backgroundColor: '#92400E', minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  approveBadgeText: { color: '#FEF3C7', fontWeight: '800', fontSize: 11 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    width: '48%', backgroundColor: colors.background, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  statCardAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5, marginTop: 4 },
  statLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  sectionTitle: { marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: '700', color: colors.textMain },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background,
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badge: { fontSize: 12, fontWeight: '700', color: colors.textMain, backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { color: colors.primaryFg, fontWeight: '700' },
  roleTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.secondary },
  roleTagAdmin: { backgroundColor: '#EFF6FF' },
  roleTagText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  roleTagTextAdmin: { color: colors.primary },
  empty: { padding: 18, alignItems: 'center', backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textMuted },
});
