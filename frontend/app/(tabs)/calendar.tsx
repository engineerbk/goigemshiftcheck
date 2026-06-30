import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';
import NotificationBell from '../../src/components/NotificationBell';
import ApprovalBadge from '../../src/components/ApprovalBadge';

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // shift so Monday=0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Calendar() {
  const { user } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [shifts, setShifts] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<{ incoming: any[]; outgoing: any[] }>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const startStr = fmtDate(days[0]);
  const endStr = fmtDate(days[6]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sw] = await Promise.all([api.allShifts(startStr, endStr), api.listSwaps()]);
      setShifts(s);
      setSwaps(sw);
    } catch (e: any) {
      console.log('cal err', e?.message);
    }
    setLoading(false);
  }, [startStr, endStr]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const isAdmin = user?.role === 'admin';

  const onShiftPress = (s: any) => {
    const isMine = s.user_id === user?.id;
    const options: any[] = [];
    if (isAdmin && (s.approval_status === 'pending' || !s.approval_status)) {
      options.push({
        text: t('approve'),
        onPress: () => {
          Alert.alert(t('approve_shift_confirm'), `${s.user_name || s.user_email}\n${s.date} ${s.start_time}–${s.end_time}`, [
            { text: t('cancel'), style: 'cancel' },
            { text: t('approve'), onPress: async () => {
              try { await api.adminApproveShift(s.id); load(); }
              catch (e: any) { Alert.alert(t('failed'), e.message); }
            } },
          ]);
        },
      });
      options.push({
        text: t('deny'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('deny_shift_confirm'), `${s.user_name || s.user_email}\n${s.date} ${s.start_time}–${s.end_time}`, [
            { text: t('cancel'), style: 'cancel' },
            { text: t('deny'), style: 'destructive', onPress: async () => {
              try { await api.adminRejectShift(s.id, ''); load(); }
              catch (e: any) { Alert.alert(t('failed'), e.message); }
            } },
          ]);
        },
      });
    }
    if (isAdmin && s.approval_status === 'approved') {
      options.push({
        text: t('revert_approval'),
        onPress: () => {
          Alert.alert(t('revert_approval_confirm'), `${s.user_name || s.user_email}\n${s.date} ${s.start_time}–${s.end_time}`, [
            { text: t('cancel'), style: 'cancel' },
            { text: t('revert_approval'), onPress: async () => {
              try { await api.adminUnapproveShift(s.id); load(); }
              catch (e: any) { Alert.alert(t('failed'), e.message); }
            } },
          ]);
        },
      });
    }
    if (isAdmin || (isMine && s.approval_status !== 'approved')) {
      options.push({ text: t('edit'), onPress: () => router.push({ pathname: '/shift-edit/[id]', params: { id: s.id } }) });
    }
    if (isMine) {
      options.push({
        text: t('swap_from_this'),
        onPress: () => router.push({ pathname: '/swap-from/[id]', params: { id: s.id } }),
      });
    }
    if (!isMine) {
      options.push({ text: t('request_swap'), onPress: () => router.push({ pathname: '/swap/[targetId]', params: { targetId: s.id } }) });
    }
    options.push({ text: t('cancel'), style: 'cancel' });
    const lockedTag = s.approval_status === 'approved' ? `\n🔒 ${t('approved_locked')}` : '';
    Alert.alert(
      `${s.user_name || s.user_email}`,
      `${s.date} • ${s.start_time}–${s.end_time}${s.note ? '\n' + s.note : ''}${lockedTag}`,
      options,
    );
  };

  const onAcceptSwap = async (id: string) => {
    try { await api.acceptSwap(id); Alert.alert(t('swap_accepted')); load(); }
    catch (e: any) { Alert.alert(t('failed'), e.message); }
  };
  const onRejectSwap = async (id: string) => {
    try { await api.rejectSwap(id); Alert.alert(t('swap_rejected')); load(); }
    catch (e: any) { Alert.alert(t('failed'), e.message); }
  };

  const pendingIncoming = swaps.incoming.filter(s => s.status === 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="calendar-screen">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('calendar_title')}</Text>
            <Text style={styles.sub}>{t('calendar_sub')}</Text>
          </View>
          <NotificationBell />
        </View>

        <View style={styles.weekNav}>
          <TouchableOpacity testID="week-prev" style={styles.navBtn} onPress={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}>
            <Ionicons name="chevron-back" size={20} color={colors.textMain} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.weekRange}>
              {days[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => setWeekStart(startOfWeek(new Date()))}>
              <Text style={styles.todayLink}>{t('today_btn')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity testID="week-next" style={styles.navBtn} onPress={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}>
            <Ionicons name="chevron-forward" size={20} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        {pendingIncoming.length > 0 && (
          <>
            <Text style={styles.section}>{t('swap_requests')} • {t('incoming')} ({pendingIncoming.length})</Text>
            {pendingIncoming.map(r => (
              <View key={r.id} style={styles.swapCard} testID={`swap-${r.id}`}>
                <Text style={styles.swapFrom}>{r.from_user_name || r.from_user_email}</Text>
                <Text style={styles.swapBody}>
                  {t('out')}: {r.target_shift.date} {r.target_shift.start_time}-{r.target_shift.end_time}
                  {'\n'}{t('in')}: {r.my_shift.date} {r.my_shift.start_time}-{r.my_shift.end_time}
                </Text>
                {r.message ? <Text style={styles.swapMsg}>“{r.message}”</Text> : null}
                <View style={styles.swapActions}>
                  <TouchableOpacity style={[styles.swapBtn, styles.swapAccept]} onPress={() => onAcceptSwap(r.id)} testID={`swap-accept-${r.id}`}>
                    <Text style={styles.swapBtnTextAccept}>{t('accept')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.swapBtn} onPress={() => onRejectSwap(r.id)} testID={`swap-reject-${r.id}`}>
                    <Text style={styles.swapBtnText}>{t('reject')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : (
          days.map((d, idx) => {
            const dStr = fmtDate(d);
            const dayShifts = shifts.filter(s => s.date === dStr);
            const isToday = fmtDate(new Date()) === dStr;
            return (
              <View key={dStr} style={styles.dayBlock}>
                <View style={styles.dayHeader}>
                  <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                    <Text style={[styles.dayBadgeNum, isToday && { color: colors.primaryFg }]}>{d.getDate()}</Text>
                  </View>
                  <Text style={styles.dayName}>{d.toLocaleDateString([], { weekday: 'long' })}</Text>
                  <Text style={styles.dayCount}>{dayShifts.length}</Text>
                </View>
                {dayShifts.length === 0 ? (
                  <Text style={styles.dayEmpty}>{t('no_shifts_day')}</Text>
                ) : (
                  dayShifts.map(s => {
                    const mine = s.user_id === user?.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        testID={`cal-shift-${s.id}`}
                        style={[styles.shiftPill, mine && styles.shiftPillMine]}
                        onPress={() => onShiftPress(s)}
                      >
                        <View style={styles.shiftTimeBox}>
                          <Text style={[styles.shiftTime, mine && styles.shiftTimeMine]}>{s.start_time}</Text>
                          <Text style={styles.shiftDash}>–</Text>
                          <Text style={[styles.shiftTime, mine && styles.shiftTimeMine]}>{s.end_time}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.shiftName, mine && styles.shiftNameMine]} numberOfLines={1}>
                            {s.user_name || s.user_email}{mine ? '  •  ' + t('actions').toLowerCase() : ''}
                          </Text>
                          {s.note ? <Text style={styles.shiftNote} numberOfLines={1}>{s.note}</Text> : null}
                          <View style={{ marginTop: 4 }}>
                            <ApprovalBadge status={s.approval_status} size="tiny" />
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={mine ? colors.primary : colors.textLight} />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            );
          })
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  weekNav: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 6, marginBottom: 18 },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  weekRange: { fontSize: 16, fontWeight: '700', color: colors.textMain },
  todayLink: { color: colors.primary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  section: { marginTop: 4, marginBottom: 10, fontSize: 15, fontWeight: '700', color: colors.textMain },
  swapCard: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 14, padding: 14, marginBottom: 10 },
  swapFrom: { fontWeight: '700', color: colors.textMain },
  swapBody: { color: colors.textMain, marginTop: 6, fontSize: 13, lineHeight: 18 },
  swapMsg: { color: colors.textMuted, fontStyle: 'italic', marginTop: 6, fontSize: 12 },
  swapActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  swapBtn: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  swapAccept: { backgroundColor: colors.primary, borderColor: colors.primary },
  swapBtnText: { color: colors.textMain, fontWeight: '700', fontSize: 13 },
  swapBtnTextAccept: { color: colors.primaryFg, fontWeight: '700', fontSize: 13 },
  dayBlock: { marginBottom: 14 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dayBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  dayBadgeToday: { backgroundColor: colors.primary },
  dayBadgeNum: { fontWeight: '800', color: colors.textMain, fontSize: 13 },
  dayName: { flex: 1, fontWeight: '700', color: colors.textMain, fontSize: 14 },
  dayCount: { fontSize: 12, color: colors.textLight, fontWeight: '600' },
  dayEmpty: { color: colors.textLight, fontSize: 12, paddingLeft: 42, fontStyle: 'italic' },
  shiftPill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.background, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: colors.border, marginBottom: 6, marginLeft: 0,
  },
  shiftPillMine: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  shiftTimeBox: { alignItems: 'center', minWidth: 60 },
  shiftTime: { fontWeight: '700', fontSize: 12, color: colors.textMain },
  shiftTimeMine: { color: colors.primary },
  shiftDash: { fontSize: 9, color: colors.textLight, marginVertical: 1 },
  shiftName: { fontSize: 13, fontWeight: '600', color: colors.textMain },
  shiftNameMine: { color: colors.primary },
  shiftNote: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
