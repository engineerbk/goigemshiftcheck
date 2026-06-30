import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';

export default function SwapRequest() {
  const { targetId } = useLocalSearchParams<{ targetId: string }>();
  const router = useRouter();
  const { t } = useLang();
  const [target, setTarget] = useState<any>(null);
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [all, mine] = await Promise.all([api.allShifts(), api.myShifts()]);
      const found = all.find((s: any) => s.id === targetId);
      if (!found) { Alert.alert(t('failed'), 'Target not found'); router.back(); return; }
      setTarget(found);
      setMyShifts(mine);
    } catch (e: any) { Alert.alert(t('failed'), e.message); }
    setLoading(false);
  }, [targetId, router, t]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!picked) { Alert.alert(t('missing_fields'), t('pick_my_shift')); return; }
    if (!target) return;
    setSubmitting(true);
    try {
      await api.createSwap(picked, target.id, message);
      Alert.alert(t('swap_sent'));
      router.back();
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !target) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="swap-screen">
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('request_swap')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>{t('out')}</Text>
          <Text style={styles.targetName}>{target.user_name || target.user_email}</Text>
          <Text style={styles.targetTime}>{target.date}  •  {target.start_time}–{target.end_time}</Text>
          {target.note ? <Text style={styles.targetNote}>{target.note}</Text> : null}
        </View>

        <Text style={styles.section}>{t('pick_my_shift')}</Text>
        {myShifts.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('no_shifts')}</Text></View>
        ) : (
          myShifts.map((s) => (
            <TouchableOpacity
              key={s.id}
              testID={`pick-${s.id}`}
              style={[styles.shiftRow, picked === s.id && styles.shiftRowActive]}
              onPress={() => setPicked(s.id)}
            >
              <View style={styles.dateBox}>
                <Text style={styles.dateNum}>{new Date(s.date).getDate()}</Text>
                <Text style={styles.dateMon}>{new Date(s.date).toLocaleDateString([], { month: 'short' }).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shiftTime}>{s.start_time} – {s.end_time}</Text>
                {s.note ? <Text style={styles.shiftNote}>{s.note}</Text> : null}
              </View>
              {picked === s.id && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
            </TouchableOpacity>
          ))
        )}

        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder={t('swap_message')}
          placeholderTextColor={colors.textLight}
          multiline
        />

        <TouchableOpacity style={styles.submit} onPress={submit} disabled={submitting || !picked} testID="swap-submit">
          {submitting ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.submitText}>{t('request_swap')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textMain },
  container: { padding: 20, paddingBottom: 60 },
  targetCard: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 18 },
  targetLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  targetName: { fontSize: 18, fontWeight: '800', color: colors.textMain, marginTop: 4 },
  targetTime: { fontSize: 14, color: colors.textMain, marginTop: 4 },
  targetNote: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  section: { fontSize: 15, fontWeight: '700', color: colors.textMain, marginBottom: 10 },
  empty: { padding: 22, alignItems: 'center', backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textMuted },
  shiftRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background,
    padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  shiftRowActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  dateBox: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  dateNum: { fontSize: 18, fontWeight: '800', color: colors.primary },
  dateMon: { fontSize: 9, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  shiftTime: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  shiftNote: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  input: { marginTop: 18, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, fontSize: 14, color: colors.textMain, minHeight: 60 },
  submit: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: colors.primaryFg, fontWeight: '700', fontSize: 16 },
});
