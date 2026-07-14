import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../src/api';
import { useLang } from '../src/i18n';
import { colors } from '../src/theme';

export default function AdminShiftApprovals() {
  const router = useRouter();
  const { t } = useLang();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.adminPendingShifts();
      setItems(list);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const onApprove = (s: any) => {
    const message = `${s.user_name || s.user_email}\n${s.date} ${s.start_time}–${s.end_time}`;
    const approve = async () => {
      setBusyId(s.id);
      try { await api.adminApproveShift(s.id); await load(); }
      catch (e: any) { Alert.alert(t('failed'), e.message); }
      setBusyId(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('approve_shift_confirm')}\n\n${message}`)) approve();
      return;
    }
    Alert.alert(
      t('approve_shift_confirm'),
      message,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('approve'), onPress: approve },
      ]
    );
  };

  const onDeny = (s: any) => {
    const message = `${s.user_name || s.user_email}\n${s.date} ${s.start_time}–${s.end_time}`;
    const deny = async () => {
      setBusyId(s.id);
      try { await api.adminRejectShift(s.id, ''); await load(); }
      catch (e: any) { Alert.alert(t('failed'), e.message); }
      setBusyId(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('deny_shift_confirm')}\n\n${message}`)) deny();
      return;
    }
    Alert.alert(
      t('deny_shift_confirm'),
      message,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('deny'), style: 'destructive', onPress: deny },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="admin-approvals-screen">
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('pending_shifts')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={42} color={colors.textLight} />
            <Text style={styles.emptyText}>{t('no_pending_shifts')}</Text>
          </View>
        ) : (
          items.map(s => (
            <View key={s.id} style={styles.card} testID={`approval-${s.id}`}>
              <View style={styles.cardHeader}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>{new Date(s.date).getDate()}</Text>
                  <Text style={styles.dateMon}>{new Date(s.date).toLocaleDateString([], { month: 'short' }).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName}>{s.user_name || s.user_email}</Text>
                  <Text style={styles.timeRow}>{s.start_time} – {s.end_time}{s.shift_type ? `  •  ${t(`shift_${s.shift_type}` as any)}` : ''}</Text>
                  {s.store_location ? <Text style={styles.locRow} numberOfLines={1}>📍 {s.store_location}</Text> : null}
                  {s.note ? <Text style={styles.noteRow} numberOfLines={2}>{s.note}</Text> : null}
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  testID={`approve-btn-${s.id}`}
                  style={[styles.btn, styles.btnApprove, busyId === s.id && { opacity: 0.5 }]}
                  disabled={busyId === s.id}
                  onPress={() => onApprove(s)}
                >
                  <Ionicons name="checkmark" size={16} color={colors.primaryFg} />
                  <Text style={styles.btnApproveText}>{t('approve')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`deny-btn-${s.id}`}
                  style={[styles.btn, busyId === s.id && { opacity: 0.5 }]}
                  disabled={busyId === s.id}
                  onPress={() => onDeny(s)}
                >
                  <Ionicons name="close" size={16} color={colors.error} />
                  <Text style={styles.btnDenyText}>{t('deny')}</Text>
                </TouchableOpacity>
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
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textMain },
  container: { padding: 20, paddingBottom: 50 },
  empty: { alignItems: 'center', padding: 60, gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  card: { backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  dateBox: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 20, fontWeight: '800', color: colors.textMain },
  dateMon: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  empName: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  timeRow: { fontSize: 13, color: colors.textMain, marginTop: 2 },
  locRow: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  noteRow: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  btnApprove: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnApproveText: { color: colors.primaryFg, fontWeight: '700', fontSize: 13 },
  btnDenyText: { color: colors.error, fontWeight: '700', fontSize: 13 },
});
