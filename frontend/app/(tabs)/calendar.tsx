import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';
import { STORE_LOCATIONS, SHIFT_PRESETS } from '../../src/shift-options';
import NotificationBell from '../../src/components/NotificationBell';

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

const STORE_META: Record<string, { code: string; capacity: number }> = {
  '74 Hàng Nón': { code: 'NON', capacity: 2 },
  '4B Trần Phú': { code: 'TPU', capacity: 2 },
  '32 Hàng Bè': { code: 'HBE', capacity: 2 },
  '07 Nhà Chung': { code: 'NCH', capacity: 2 },
  '53 Lương Ngọc Quyến': { code: 'LNQ', capacity: 2 },
  '13 Lý Quốc Sư': { code: 'QSU', capacity: 3 },
  'Kho Tổng 22-89C': { code: 'KHO TỔNG', capacity: 1 },
};

function shortStoreName(name: string) {
  return name.replace('Kho Tổng 22-89C', 'Kho Tổng');
}

function staffingState(count: number, capacity: number) {
  if (count <= 0) return 'empty';
  if (count < capacity) return 'short';
  return 'full';
}

function statusColor(state: string) {
  if (state === 'full') return colors.success;
  if (state === 'short') return '#FACC15';
  return colors.error;
}

function matchesPreset(s: any, preset: { type: string; start: string; end: string }) {
  return s.shift_type === preset.type || (!s.shift_type && s.start_time === preset.start && s.end_time === preset.end);
}

export default function Calendar() {
  const { user } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(fmtDate(new Date()));
  const [selectedShiftType, setSelectedShiftType] = useState<'morning' | 'afternoon' | 'evening'>('afternoon');
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

  const moveWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
    setSelectedDate(fmtDate(d));
  };

  const goToday = () => {
    const today = new Date();
    setWeekStart(startOfWeek(today));
    setSelectedDate(fmtDate(today));
  };

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

  const onCellPress = (items: any[]) => {
    if (items.length === 0) return;
    if (items.length === 1) {
      onShiftPress(items[0]);
      return;
    }
    Alert.alert(
      t('select_shift'),
      '',
      [
        ...items.map((s) => ({
          text: s.user_name || s.user_email,
          onPress: () => onShiftPress(s),
        })),
        { text: t('cancel'), style: 'cancel' as const },
      ],
    );
  };

  const pendingIncoming = swaps.incoming.filter(s => s.status === 'pending');
  const selectedDayShifts = shifts.filter(s => s.date === selectedDate);
  const selectedPreset = SHIFT_PRESETS.find(p => p.type === selectedShiftType) || SHIFT_PRESETS[1];

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="calendar-screen">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('calendar_title')}</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>{t('staff_full')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FACC15' }]} />
                <Text style={styles.legendText}>{t('staff_short')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                <Text style={styles.legendText}>{t('staff_empty')}</Text>
              </View>
            </View>
          </View>
          <NotificationBell />
        </View>

        <View style={styles.weekNav}>
          <TouchableOpacity testID="week-prev" style={styles.navBtn} onPress={() => moveWeek(-1)}>
            <Ionicons name="chevron-back" size={28} color={colors.textMain} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.weekRange}>
              {days[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={goToday}>
              <Text style={styles.todayLink}>{t('today_btn')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity testID="week-next" style={styles.navBtn} onPress={() => moveWeek(1)}>
            <Ionicons name="chevron-forward" size={28} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        <View style={styles.dayTabs}>
          {days.map((d) => {
            const dStr = fmtDate(d);
            const active = selectedDate === dStr;
            return (
              <TouchableOpacity
                key={dStr}
                testID={`cal-day-${dStr}`}
                style={[styles.dayTab, active && styles.dayTabActive]}
                onPress={() => setSelectedDate(dStr)}
              >
                <Text style={[styles.dayTabName, active && styles.dayTabTextActive]}>
                  {d.toLocaleDateString([], { weekday: 'short' }).toUpperCase()}
                </Text>
                <Text style={[styles.dayTabNum, active && styles.dayTabTextActive]}>{d.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
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
          <View style={styles.roster}>
            <View style={styles.gridHeader}>
              <View style={styles.storeHeaderSpacer} />
              {SHIFT_PRESETS.map((preset) => {
                const active = selectedShiftType === preset.type;
                return (
                  <TouchableOpacity
                    key={preset.type}
                    style={[styles.shiftHeader, active && styles.shiftHeaderActive]}
                    onPress={() => setSelectedShiftType(preset.type)}
                    testID={`cal-shift-type-${preset.type}`}
                  >
                    <Text style={[styles.shiftHeaderText, active && styles.shiftHeaderTextActive]}>
                      {t(`shift_${preset.type}` as any)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {STORE_LOCATIONS.map((store) => {
              const meta = STORE_META[store] || { code: store.slice(0, 3).toUpperCase(), capacity: 2 };
              const selectedCount = selectedDayShifts.filter(s => {
                const preset = SHIFT_PRESETS.find(p => p.type === selectedShiftType);
                return s.store_location === store && preset && matchesPreset(s, preset);
              }).length;
              const state = staffingState(selectedCount, meta.capacity);
              return (
                <View key={store} style={styles.gridRow}>
                  <View style={styles.storeCell}>
                    <Text style={[styles.storeCode, { color: statusColor(state) }]}>{meta.code}</Text>
                    <Text style={styles.storeName} numberOfLines={1}>{shortStoreName(store)}</Text>
                    <View style={styles.storeCountRow}>
                      <View style={[styles.storeStatusDot, { backgroundColor: statusColor(state) }]} />
                      <Text style={[styles.storeCount, { color: statusColor(state) }]}>
                        {selectedCount}/{meta.capacity}
                      </Text>
                    </View>
                  </View>

                  {SHIFT_PRESETS.map((preset) => {
                    const activeColumn = selectedShiftType === preset.type;
                    const cellShifts = selectedDayShifts.filter(s => s.store_location === store && matchesPreset(s, preset));
                    return (
                      <TouchableOpacity
                        key={`${store}-${preset.type}`}
                        style={[styles.rosterCell, activeColumn && styles.rosterCellActive]}
                        onPress={() => onCellPress(cellShifts)}
                        disabled={cellShifts.length === 0}
                        testID={`cal-cell-${store}-${preset.type}`}
                      >
                        {cellShifts.length === 0 ? (
                          activeColumn && store === 'Kho Tổng 22-89C' ? <Text style={styles.offText}>OFF</Text> : null
                        ) : (
                          cellShifts.slice(0, 3).map((s) => {
                            const mine = s.user_id === user?.id;
                            return (
                              <Text
                                key={s.id}
                                style={[styles.staffName, activeColumn && styles.staffNameActive, mine && styles.staffNameMine]}
                                numberOfLines={1}
                              >
                                {s.user_name || s.user_email}
                              </Text>
                            );
                          })
                        )}
                        {cellShifts.length > 3 ? (
                          <Text style={[styles.moreText, activeColumn && styles.moreTextActive]}>+{cellShifts.length - 3}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
            <Text style={styles.gridFootnote}>
              {t('selected_shift')}: {t(`shift_${selectedPreset.type}` as any)} {selectedPreset.start} - {selectedPreset.end}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 18, paddingBottom: 30 },
  title: { fontSize: 32, fontWeight: '900', color: colors.textMain, letterSpacing: 0, marginBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 22 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2 },
  legendText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  weekNav: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 8, marginBottom: 8 },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  weekRange: { fontSize: 19, fontWeight: '900', color: colors.textMain },
  todayLink: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 2 },
  dayTabs: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  dayTab: { flex: 1, height: 62, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayTabActive: { backgroundColor: colors.primary },
  dayTabName: { fontSize: 12, fontWeight: '900', color: colors.textMuted },
  dayTabNum: { fontSize: 21, fontWeight: '900', color: colors.textMain, marginTop: 2 },
  dayTabTextActive: { color: colors.primaryFg },
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
  roster: { marginTop: 2 },
  gridHeader: { flexDirection: 'row', gap: 7, alignItems: 'flex-end', marginBottom: 7 },
  storeHeaderSpacer: { width: 78 },
  shiftHeader: { flex: 1, minHeight: 40, borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shiftHeaderActive: { backgroundColor: colors.primary },
  shiftHeaderText: { color: colors.textMuted, fontWeight: '900', fontSize: 15 },
  shiftHeaderTextActive: { color: colors.primaryFg },
  gridRow: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  storeCell: { width: 78, justifyContent: 'center' },
  storeCode: { fontSize: 17, fontWeight: '900', lineHeight: 19 },
  storeName: { color: colors.textMuted, fontSize: 9, fontWeight: '800', marginTop: 1 },
  storeCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  storeStatusDot: { width: 13, height: 13, borderRadius: 7 },
  storeCount: { fontSize: 13, fontWeight: '900' },
  rosterCell: {
    flex: 1, minHeight: 82, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 9,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center',
  },
  rosterCellActive: { borderWidth: 6, borderColor: colors.primary, paddingHorizontal: 6, paddingVertical: 6 },
  staffName: { color: colors.textLight, fontSize: 16, fontWeight: '900', lineHeight: 24 },
  staffNameActive: { color: colors.textMain },
  staffNameMine: { color: colors.primary },
  moreText: { color: colors.textLight, fontWeight: '900', fontSize: 12, marginTop: 2 },
  moreTextActive: { color: colors.textMain },
  offText: { color: colors.textMain, fontWeight: '900', fontSize: 18, textAlign: 'center' },
  gridFootnote: { color: colors.textMuted, textAlign: 'center', marginTop: 10, fontWeight: '700', fontSize: 12 },
});
