import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { useLang } from '../../src/i18n';
import { api } from '../../src/api';
import { colors } from '../../src/theme';
import NotificationBell from '../../src/components/NotificationBell';

function formatTime(iso?: string | null) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function elapsed(fromIso: string) {
  const ms = Date.now() - new Date(fromIso).getTime();
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function shiftTitle(current: any, t: (key: any) => string) {
  const start = current?.shift_start_time;
  const end = current?.shift_end_time;
  const type = current?.shift_type;
  const name = type ? t(`shift_${type}` as any) : t('work_shift');
  if (start && end) return `${name} ${start} - ${end}`;
  return name;
}

function minutesPastShiftEnd(current: any, nowMs: number) {
  const date = current?.check_in_local_date;
  const end = current?.shift_end_time;
  if (!date || !end) return null;
  const endAt = new Date(`${date}T${end}:00`).getTime();
  if (Number.isNaN(endAt)) return null;
  const mins = Math.floor((nowMs - endAt) / 60000);
  return mins > 0 ? mins : null;
}

function formatDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function localTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Home() {
  const { user } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [status, setStatus] = useState<{ checked_in: boolean; current: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      if (isOwner) {
        const items = await api.adminTasks();
        setTasks(items || []);
        setStatus(null);
      } else {
        const s = await api.attendanceStatus();
        setStatus(s);
      }
    } catch (e: any) {
      console.log('status error', e.message);
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const getCoords = async (): Promise<{ lat: number | null; lng: number | null; address: string | null }> => {
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') return { lat: null, lng: null, address: null };
      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      let address: string | null = null;
      try {
        const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (places && places.length > 0) {
          const p = places[0];
          address = [p.name, p.street, p.district, p.city, p.region, p.country]
            .filter((v) => v && String(v).trim().length > 0)
            .join(', ');
        }
      } catch {}
      return { lat, lng, address };
    } catch {
      return { lat: null, lng: null, address: null };
    }
  };

  const onCheckIn = async () => {
    setActing(true);
    try {
      const { lat, lng, address } = await getCoords();
      const r = await api.checkIn(lat, lng, address, localDate(), localTime());
      await load();
      if (r?.late_minutes && r.late_minutes > 0) {
        Alert.alert(t('you_are_late'), `${t('late_by')} ${r.late_minutes} ${t('minutes_short')}`);
      }
    } catch (e: any) {
      Alert.alert(t('checkin_failed'), e.message || t('try_again'));
    } finally {
      setActing(false);
    }
  };

  const onCheckOut = async () => {
    setActing(true);
    try {
      const { lat, lng, address } = await getCoords();
      await api.checkOut(lat, lng, address, localDate(), localTime());
      await load();
    } catch (e: any) {
      Alert.alert(t('checkout_failed'), e.message || t('try_again'));
    } finally {
      setActing(false);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('greet_morning');
    if (h < 18) return t('greet_afternoon');
    return t('greet_evening');
  })();

  const isIn = !!status?.checked_in;
  const current = status?.current;
  const checkoutOverdueMinutes = isIn && current ? minutesPastShiftEnd(current, now) : null;
  const openTasks = tasks.filter((task) => task.status === 'open');
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const cancelledTasks = tasks.filter((task) => task.status === 'cancelled');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="home-screen">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.brandRow}>
          <Image source={require('../../assets/images/logo.jpg')} style={styles.brandLogo} />
          <Text style={styles.brandText}>{t('brand')}</Text>
          <View style={{ flex: 1 }} />
          <NotificationBell />
        </View>
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>{greeting},</Text>
            <Text style={styles.name} testID="home-user-name">{user?.name || 'there'}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : isOwner ? (
          <View testID="director-home-tasks">
            <View style={styles.directorHero}>
              <View style={styles.heroRow}>
                <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.heroLabel}>TASK DASHBOARD</Text>
              </View>
              <Text style={styles.directorTitle}>Công việc đang giao</Text>
              <Text style={styles.heroSub}>Theo dõi hiện trạng task của tất cả cửa hàng.</Text>
            </View>

            <View style={styles.taskStatsGrid}>
              <TaskStat label="Đang mở" value={openTasks.length} color={colors.warning} />
              <TaskStat label="Hoàn thành" value={completedTasks.length} color={colors.success} />
              <TaskStat label="Đã huỷ" value={cancelledTasks.length} color={colors.error} />
            </View>

            <Text style={styles.taskSectionTitle}>Task đang mở</Text>
            {openTasks.length === 0 ? (
              <View style={styles.emptyTaskBox}>
                <Text style={styles.emptyTaskText}>Không có task đang mở</Text>
              </View>
            ) : (
              openTasks.slice(0, 30).map((task) => (
                <View key={task.id} style={styles.taskRow} testID={`home-open-task-${task.id}`}>
                  <View style={[styles.taskDot, { backgroundColor: colors.warning }]} />
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
                    testID={`home-open-task-detail-${task.id}`}
                  >
                    <Text style={styles.taskName}>{task.title}</Text>
                    {task.description ? <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text> : null}
                    <Text style={styles.taskMeta}>
                      {task.store_location || '—'} • giao cho {task.assigned_user_name || task.assigned_user_email || 'quản lý cửa hàng'}
                    </Text>
                    <Text style={styles.taskMeta}>Giao bởi {task.created_by_name || '—'}</Text>
                  </TouchableOpacity>
                  <View style={styles.statusBadgeOpen}>
                    <Text style={styles.statusBadgeOpenText}>Mở</Text>
                  </View>
                </View>
              ))
            )}

            <Text style={styles.taskSectionTitle}>Task gần đây</Text>
            {tasks.slice(0, 12).map((task) => (
              <View key={`recent-${task.id}`} style={styles.taskRow}>
                <View style={[styles.taskDot, { backgroundColor: task.status === 'completed' ? colors.success : task.status === 'cancelled' ? colors.error : colors.warning }]} />
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
                  testID={`home-recent-task-detail-${task.id}`}
                >
                  <Text style={styles.taskName}>{task.title}</Text>
                  <Text style={styles.taskMeta}>
                    {task.store_location || '—'} • {task.assigned_user_name || task.assigned_user_email || 'task cửa hàng'} • {task.status}
                  </Text>
                  {task.completed_by_name ? <Text style={styles.taskMeta}>Hoàn thành bởi {task.completed_by_name}</Text> : null}
                  {task.last_review_comment ? <Text style={styles.reviewComment} numberOfLines={2}>“{task.last_review_comment}”</Text> : null}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={[styles.heroCard, isIn ? styles.heroCardActive : null]}>
              <View style={styles.heroRow}>
                <View style={[styles.statusDot, { backgroundColor: isIn ? colors.success : colors.textLight }]} />
                <Text style={styles.heroLabel}>{isIn ? t('on_shift') : t('off_duty')}</Text>
              </View>
              {isIn && current ? (
                <>
                  <Text style={styles.activeShiftLine} testID="active-shift-info">{shiftTitle(current, t)}</Text>
                  <Text style={styles.workedLine} testID="elapsed-time">
                    {t('worked_for')}: <Text style={styles.workedValue}>{elapsed(current.check_in)}</Text>
                  </Text>
                  <Text style={styles.heroSub}>{t('started_at')} {formatTime(current.check_in)}</Text>
                  {checkoutOverdueMinutes ? (
                    <View style={styles.checkoutOverdueBadge} testID="checkout-overdue-badge">
                      <Ionicons name="warning" size={13} color={colors.warning} />
                      <Text style={styles.checkoutOverdueText}>
                        {t('checkout_overdue')} {formatDuration(checkoutOverdueMinutes)}
                      </Text>
                    </View>
                  ) : null}
                  {current.late_minutes != null && current.late_minutes > 0 ? (
                    <View style={styles.lateBadge} testID="late-badge">
                      <Ionicons name="warning" size={12} color={colors.error} />
                      <Text style={styles.lateBadgeText}>{t('late_by')} {current.late_minutes} {t('minutes_short')}</Text>
                    </View>
                  ) : current.shift_id ? (
                    <View style={styles.onTimeBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                      <Text style={styles.onTimeBadgeText}>{t('on_time')}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.bigTime}>{t('ready_to_start')}</Text>
                  <Text style={styles.heroSub}>{t('tap_to_start')}</Text>
                </>
              )}

              <TouchableOpacity
                testID="check-in-btn"
                style={[styles.ctaBtn, isIn ? styles.ctaBtnOut : styles.ctaBtnIn]}
                onPress={isIn ? onCheckOut : onCheckIn}
                disabled={acting}
              >
                {acting ? (
                  <ActivityIndicator color={colors.primaryFg} />
                ) : (
                  <>
                    <Ionicons name={isIn ? 'log-out-outline' : 'log-in-outline'} size={22} color={colors.primaryFg} />
                    <Text style={styles.ctaText}>{isIn ? t('check_out') : t('check_in')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCard}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>{t('location')}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {current?.check_in_address || (current?.check_in_lat ? t('captured') : '—')}
                </Text>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>{t('today')}</Text>
                <Text style={styles.infoValue}>{new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
              </View>
            </View>

            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>{t('how_it_works')}</Text>
              <View style={styles.tipRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.tipText}>{t('tip_register')}</Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.tipText}>{t('tip_checkin')}</Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.tipText}>{t('tip_history')}</Text>
              </View>
            </View>
          </>
        )}
        <Text style={styles.tick}>{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.taskStatCard}>
      <View style={[styles.taskStatDot, { backgroundColor: color }]} />
      <Text style={styles.taskStatValue}>{value}</Text>
      <Text style={styles.taskStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20, paddingBottom: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  brandLogo: { width: 36, height: 36, borderRadius: 10 },
  brandText: { fontSize: 18, fontWeight: '800', color: colors.textMain, letterSpacing: -0.3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greet: { fontSize: 14, color: colors.textMuted },
  name: { fontSize: 24, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.primaryFg, fontWeight: '700', fontSize: 18 },
  heroCard: {
    backgroundColor: colors.background, borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  heroCardActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  heroLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: colors.textMuted },
  bigTime: { fontSize: 36, fontWeight: '800', color: colors.textMain, marginTop: 10, letterSpacing: -1 },
  activeShiftLine: { fontSize: 20, fontWeight: '800', color: colors.textMain, marginTop: 12 },
  workedLine: { color: colors.textMuted, marginTop: 6, fontSize: 15, fontWeight: '600' },
  workedValue: { color: colors.textMain, fontWeight: '800' },
  heroSub: { color: colors.textMuted, marginTop: 4, fontSize: 14 },
  lateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEE2E2', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
    marginTop: 10,
  },
  lateBadgeText: { color: colors.error, fontWeight: '700', fontSize: 12 },
  onTimeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D1FAE5', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
    marginTop: 10,
  },
  onTimeBadgeText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  checkoutOverdueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FEF3C7', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
    marginTop: 10,
  },
  checkoutOverdueText: { color: '#92400E', fontWeight: '800', fontSize: 12 },
  ctaBtn: {
    marginTop: 20, paddingVertical: 18, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  ctaBtnIn: { backgroundColor: colors.primary, shadowColor: colors.primary },
  ctaBtnOut: { backgroundColor: colors.error, shadowColor: colors.error },
  ctaText: { color: colors.primaryFg, fontSize: 17, fontWeight: '700' },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  infoCard: {
    flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, padding: 16, gap: 6,
  },
  infoLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  infoValue: { fontSize: 16, fontWeight: '700', color: colors.textMain },
  tipsCard: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, padding: 18, gap: 10,
  },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain, marginBottom: 4 },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  tipText: { flex: 1, color: colors.textMain, fontSize: 14 },
  tick: { textAlign: 'center', color: colors.textLight, marginTop: 20, fontSize: 12 },
  directorHero: {
    backgroundColor: colors.background, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  directorTitle: { fontSize: 28, fontWeight: '900', color: colors.textMain, marginTop: 10 },
  taskStatsGrid: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  taskStatCard: {
    flex: 1, backgroundColor: colors.background, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  taskStatDot: { width: 9, height: 9, borderRadius: 5, marginBottom: 8 },
  taskStatValue: { color: colors.textMain, fontSize: 24, fontWeight: '900' },
  taskStatLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 2 },
  taskSectionTitle: { color: colors.textMain, fontSize: 17, fontWeight: '900', marginTop: 10, marginBottom: 10 },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.background, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10,
  },
  taskDot: { width: 9, height: 9, borderRadius: 5 },
  taskName: { color: colors.textMain, fontSize: 14, fontWeight: '900' },
  taskDesc: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  taskMeta: { color: colors.textLight, fontSize: 11, fontWeight: '700', marginTop: 4 },
  statusBadgeOpen: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeOpenText: { color: '#92400E', fontSize: 10, fontWeight: '900' },
  emptyTaskBox: { backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 18, alignItems: 'center', marginBottom: 10 },
  emptyTaskText: { color: colors.textMuted, fontWeight: '700' },
  reviewComment: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
});
