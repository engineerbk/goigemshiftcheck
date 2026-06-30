import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../src/api';
import { useLang } from '../src/i18n';
import { useNotifications } from '../src/notifications';
import { colors } from '../src/theme';

function relativeTime(iso: string, t: (k: string) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t('just_now');
  if (min < 60) return `${min}${t('minutes_ago')}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}${t('hours_ago')}`;
  const d = Math.floor(hr / 24);
  return `${d}${t('days_ago')}`;
}

function iconFor(type: string): { name: any; color: string } {
  if (type === 'swap_incoming') return { name: 'swap-horizontal', color: colors.warning };
  if (type === 'swap_accepted') return { name: 'checkmark-circle', color: colors.success };
  if (type === 'swap_rejected') return { name: 'close-circle', color: colors.error };
  if (type === 'shift_assigned') return { name: 'add-circle', color: colors.primary };
  if (type === 'shift_unassigned') return { name: 'remove-circle', color: colors.textMuted };
  if (type === 'shift_pending_approval') return { name: 'time', color: colors.warning };
  if (type === 'shift_approved') return { name: 'checkmark-done-circle', color: colors.success };
  if (type === 'shift_rejected') return { name: 'close-circle', color: colors.error };
  if (type === 'shift_unapproved') return { name: 'refresh-circle', color: colors.warning };
  if (type === 'swap_pending_admin') return { name: 'shield-checkmark', color: colors.warning };
  if (type === 'swap_new_request') return { name: 'add-circle', color: colors.warning };
  return { name: 'notifications', color: colors.primary };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useLang();
  const { refresh } = useNotifications();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listNotifications();
      setItems(list);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const onItem = async (n: any) => {
    if (!n.read) {
      try { await api.markRead(n.id); } catch {}
      setItems((arr) => arr.map(x => x.id === n.id ? { ...x, read: true } : x));
      refresh();
    }
    // Smart navigate based on type
    if (n.type?.startsWith('swap_')) {
      router.push('/(tabs)/calendar');
    } else if (n.type?.startsWith('shift_')) {
      router.push('/(tabs)/calendar');
    }
  };

  const onMarkAll = async () => {
    try { await api.markAllRead(); } catch {}
    setItems((arr) => arr.map(x => ({ ...x, read: true })));
    refresh();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="notifications-screen">
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('notifications')}</Text>
        <TouchableOpacity onPress={onMarkAll} style={styles.markBtn} testID="mark-all">
          <Text style={styles.markText}>{t('mark_all_read')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={42} color={colors.textLight} />
            <Text style={styles.emptyText}>{t('no_notifications')}</Text>
          </View>
        ) : (
          items.map((n) => {
            const ic = iconFor(n.type);
            return (
              <TouchableOpacity
                key={n.id}
                testID={`notif-${n.id}`}
                onPress={() => onItem(n)}
                style={[styles.row, !n.read && styles.rowUnread]}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: ic.color + '22' }]}>
                  <Ionicons name={ic.name} size={18} color={ic.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={2}>{n.title}</Text>
                  {n.body ? <Text style={styles.body} numberOfLines={2}>{n.body}</Text> : null}
                  <Text style={styles.time}>{relativeTime(n.created_at, t)}</Text>
                </View>
                {!n.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textMain },
  markBtn: { paddingHorizontal: 10, height: 40, justifyContent: 'center' },
  markText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  container: { padding: 20, paddingBottom: 50 },
  empty: { alignItems: 'center', padding: 60, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.background, padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  rowUnread: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  body: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  time: { fontSize: 11, color: colors.textLight, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
