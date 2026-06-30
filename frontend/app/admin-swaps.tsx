import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../src/api';
import { useLang } from '../src/i18n';
import { colors } from '../src/theme';

export default function AdminSwaps() {
  const router = useRouter();
  const { t } = useLang();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.adminListSwaps();
      setItems(list);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const doApprove = (id: string) => {
    Alert.alert(t('admin_override'), t('confirm_force_approve'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('force_approve'), onPress: async () => {
        try { await api.adminForceApproveSwap(id); load(); }
        catch (e: any) { Alert.alert(t('failed'), e.message); }
      } },
    ]);
  };
  const doReject = (id: string) => {
    Alert.alert(t('admin_override'), t('confirm_force_reject'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('force_reject'), style: 'destructive', onPress: async () => {
        try { await api.adminForceRejectSwap(id); load(); }
        catch (e: any) { Alert.alert(t('failed'), e.message); }
      } },
    ]);
  };

  const pending = items.filter(s => s.status === 'pending');
  const resolved = items.filter(s => s.status !== 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="admin-swaps-screen">
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('swap_requests_admin')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : (
          <>
            <Text style={styles.section}>{t('pending')} ({pending.length})</Text>
            {pending.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>{t('no_swaps_pending')}</Text></View>
            ) : (
              pending.map(r => (
                <View key={r.id} style={styles.card} testID={`admin-swap-${r.id}`}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="swap-horizontal" size={20} color={colors.warning} />
                    <Text style={styles.cardTitle}>{r.from_user_name || r.from_user_email}  →  {r.to_user_name || r.to_user_email}</Text>
                  </View>
                  <Text style={styles.cardLine}>{t('out')}: {r.target_shift?.date} {r.target_shift?.start_time}-{r.target_shift?.end_time}</Text>
                  <Text style={styles.cardLine}>{t('in')}: {r.my_shift?.date} {r.my_shift?.start_time}-{r.my_shift?.end_time}</Text>
                  {r.message ? <Text style={styles.msg}>“{r.message}”</Text> : null}
                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => doApprove(r.id)} testID={`approve-${r.id}`}>
                      <Ionicons name="checkmark" size={16} color={colors.primaryFg} />
                      <Text style={styles.btnApproveText}>{t('force_approve')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={() => doReject(r.id)} testID={`reject-${r.id}`}>
                      <Ionicons name="close" size={16} color={colors.error} />
                      <Text style={styles.btnText}>{t('force_reject')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <Text style={styles.section}>History ({resolved.length})</Text>
            {resolved.map(r => (
              <View key={r.id} style={[styles.card, styles.cardMuted]}>
                <View style={styles.cardHeader}>
                  <Ionicons
                    name={r.status === 'accepted' ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={r.status === 'accepted' ? colors.success : colors.error}
                  />
                  <Text style={styles.cardTitle}>{r.from_user_name || r.from_user_email}  →  {r.to_user_name || r.to_user_email}</Text>
                  <Text style={[styles.statusTag, r.status === 'accepted' ? styles.tagOk : styles.tagBad]}>{t(r.status as any) || r.status}</Text>
                </View>
                <Text style={styles.cardLineSmall}>{r.target_shift?.date} {r.target_shift?.start_time} ⇄ {r.my_shift?.date} {r.my_shift?.start_time}</Text>
                {r.admin_id ? <Text style={styles.adminTag}>· {t('admin_override')}</Text> : null}
              </View>
            ))}
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
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textMain },
  container: { padding: 20, paddingBottom: 50 },
  section: { marginTop: 8, marginBottom: 10, fontSize: 15, fontWeight: '700', color: colors.textMain },
  empty: { padding: 22, alignItems: 'center', backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textMuted },
  card: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardMuted: { backgroundColor: colors.background, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.textMain, flex: 1 },
  cardLine: { fontSize: 13, color: colors.textMain, marginTop: 2 },
  cardLineSmall: { fontSize: 12, color: colors.textMuted },
  msg: { fontStyle: 'italic', color: colors.textMuted, marginTop: 4, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  btnApprove: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnApproveText: { color: colors.primaryFg, fontWeight: '700', fontSize: 13 },
  btnText: { color: colors.error, fontWeight: '700', fontSize: 13 },
  statusTag: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  tagOk: { color: colors.success, backgroundColor: '#D1FAE5' },
  tagBad: { color: colors.error, backgroundColor: '#FEE2E2' },
  adminTag: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 4 },
});
