import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';
import { STORE_LOCATIONS, SHIFT_PRESETS } from '../../src/shift-options';
import ApprovalBadge from '../../src/components/ApprovalBadge';

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Tab = 'peer' | 'new';

export default function SwapFromShift() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLang();

  const [myShift, setMyShift] = useState<any>(null);
  const [allShifts, setAllShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('peer');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // New-shift form state
  const today = new Date();
  const [date, setDate] = useState<Date>(today);
  const [start, setStart] = useState<Date>(today);
  const [end, setEnd] = useState<Date>(new Date(today.getTime() + 8 * 3600 * 1000));
  const [storeLocation, setStoreLocation] = useState('');
  const [shiftType, setShiftType] = useState<'morning' | 'afternoon' | 'evening' | ''>('');
  const [mode, setMode] = useState<'date' | 'start' | 'end' | null>(null);
  const [tempValue, setTempValue] = useState<Date>(today);
  const [pickerSheet, setPickerSheet] = useState<null | 'store' | 'shiftType'>(null);

  const load = useCallback(async () => {
    try {
      const mine = await api.myShifts();
      const m = mine.find((s: any) => s.id === id);
      setMyShift(m);
      if (m) {
        setDate(new Date(m.date + 'T12:00:00'));
        setStoreLocation(m.store_location || '');
        setShiftType(m.shift_type || '');
      }
      const all = await api.allShifts();
      setAllShifts(all);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openPicker = (m: 'date' | 'start' | 'end') => {
    setTempValue(m === 'date' ? date : m === 'start' ? start : end);
    setMode(m);
  };
  const onChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setMode(null);
      if (event?.type !== 'set' || !selected) return;
      if (mode === 'date') setDate(selected);
      if (mode === 'start') setStart(selected);
      if (mode === 'end') setEnd(selected);
      return;
    }
    if (selected) setTempValue(selected);
  };
  const confirmPicker = () => {
    if (mode === 'date') setDate(tempValue);
    if (mode === 'start') setStart(tempValue);
    if (mode === 'end') setEnd(tempValue);
    setMode(null);
  };
  const cancelPicker = () => setMode(null);

  const onPickShiftType = (type: 'morning' | 'afternoon' | 'evening') => {
    const preset = SHIFT_PRESETS.find(p => p.type === type);
    if (!preset) return;
    setShiftType(type);
    const [sh, sm] = preset.start.split(':').map(n => parseInt(n, 10));
    const [eh, em] = preset.end.split(':').map(n => parseInt(n, 10));
    const newStart = new Date(date); newStart.setHours(sh, sm, 0, 0);
    const newEnd = new Date(date); newEnd.setHours(eh, em, 0, 0);
    setStart(newStart);
    setEnd(newEnd);
    setPickerSheet(null);
  };

  const submitPeer = async (target: any) => {
    if (!myShift) return;
    setSubmitting(true);
    try {
      await api.createSwap(myShift.id, target.id, message);
      Alert.alert(t('request_sent'));
      router.back();
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    }
    setSubmitting(false);
  };

  const submitNew = async () => {
    if (!myShift) return;
    setSubmitting(true);
    try {
      await api.createSwapNew(
        myShift.id,
        {
          date: fmtDate(date),
          start_time: fmtTime(start),
          end_time: fmtTime(end),
          note: '',
          store_location: storeLocation,
          shift_type: shiftType || '',
        },
        message,
      );
      Alert.alert(t('request_sent'), t('requires_admin_swap'));
      router.back();
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }
  if (!myShift) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('swap_from_this')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 30, alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted }}>Shift not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const peers = allShifts.filter(s => s.user_id !== user?.id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="swap-from-screen">
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('swap_from_this')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.myShiftCard}>
            <Text style={styles.cardLabel}>Your shift</Text>
            <Text style={styles.cardLine}>📅 {myShift.date}  •  ⏰ {myShift.start_time} – {myShift.end_time}</Text>
            {myShift.store_location ? <Text style={styles.cardLineSmall}>📍 {myShift.store_location}</Text> : null}
            <View style={{ marginTop: 6 }}>
              <ApprovalBadge status={myShift.approval_status} />
            </View>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              testID="tab-peer"
              style={[styles.tab, tab === 'peer' && styles.tabActive]}
              onPress={() => setTab('peer')}
            >
              <Ionicons name="people" size={16} color={tab === 'peer' ? colors.primaryFg : colors.textMain} />
              <Text style={[styles.tabText, tab === 'peer' && styles.tabTextActive]}>{t('swap_with_peer')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="tab-new"
              style={[styles.tab, tab === 'new' && styles.tabActive]}
              onPress={() => setTab('new')}
            >
              <Ionicons name="add-circle" size={16} color={tab === 'new' ? colors.primaryFg : colors.textMain} />
              <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>{t('swap_to_new')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.section}>{t('swap_message')}</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('swap_message')}
            placeholderTextColor={colors.textLight}
            style={styles.input}
            multiline
          />

          {tab === 'peer' ? (
            peers.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={36} color={colors.textLight} />
                <Text style={styles.emptyText}>{t('no_other_shifts')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.section}>{t('pick_target_shift')}</Text>
                {peers.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    testID={`peer-shift-${s.id}`}
                    style={styles.peerCard}
                    activeOpacity={0.7}
                    onPress={() => Alert.alert(
                      t('confirm'),
                      `${s.user_name || s.user_email}\n${s.date} ${s.start_time}–${s.end_time}`,
                      [
                        { text: t('cancel'), style: 'cancel' },
                        { text: t('submit_request'), onPress: () => submitPeer(s) },
                      ],
                    )}
                  >
                    <View style={styles.dateBox}>
                      <Text style={styles.dateDay}>{new Date(s.date).getDate()}</Text>
                      <Text style={styles.dateMon}>{new Date(s.date).toLocaleDateString([], { month: 'short' }).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.peerName}>{s.user_name || s.user_email}</Text>
                      <Text style={styles.peerTime}>{s.start_time} – {s.end_time}</Text>
                      {s.store_location ? <Text style={styles.peerLoc} numberOfLines={1}>📍 {s.store_location}</Text> : null}
                      <View style={{ marginTop: 4 }}>
                        <ApprovalBadge status={s.approval_status} size="tiny" />
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                ))}
              </>
            )
          ) : (
            <>
              <Text style={styles.section}>{t('propose_new_shift')}</Text>
              <View style={styles.formCard}>
                <TouchableOpacity style={styles.field} onPress={() => openPicker('date')} testID="new-date">
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('date')}</Text>
                    <Text style={styles.fieldValue}>{date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.field} onPress={() => openPicker('start')}>
                  <Ionicons name="play-circle" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('start_time')}</Text>
                    <Text style={styles.fieldValue}>{fmtTime(start)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.field} onPress={() => openPicker('end')}>
                  <Ionicons name="stop-circle" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('end_time')}</Text>
                    <Text style={styles.fieldValue}>{fmtTime(end)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.field} onPress={() => setPickerSheet('store')}>
                  <Ionicons name="storefront" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('store_location')}</Text>
                    <Text style={[styles.fieldValue, !storeLocation && { color: colors.textLight }]} numberOfLines={1}>
                      {storeLocation || t('select')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.field} onPress={() => setPickerSheet('shiftType')}>
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('work_shift')}</Text>
                    <Text style={[styles.fieldValue, !shiftType && { color: colors.textLight }]}>
                      {shiftType ? t(`shift_${shiftType}` as any) : t('select')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                testID="submit-new"
                style={[styles.submit, submitting && { opacity: 0.5 }]}
                disabled={submitting}
                onPress={submitNew}
              >
                {submitting ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.submitText}>{t('submit_request')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {Platform.OS === 'ios' ? (
            <Modal visible={mode !== null} animationType="slide" transparent onRequestClose={cancelPicker}>
              <TouchableOpacity activeOpacity={1} style={styles.modalBg} onPress={cancelPicker}>
                <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
                  <View style={styles.pickerHeader}>
                    <TouchableOpacity onPress={cancelPicker}><Text style={styles.pickerCancel}>{t('cancel')}</Text></TouchableOpacity>
                    <Text style={styles.pickerTitle}>{mode === 'date' ? t('date') : mode === 'start' ? t('start_time') : t('end_time')}</Text>
                    <TouchableOpacity onPress={confirmPicker}><Text style={styles.pickerDone}>{t('done')}</Text></TouchableOpacity>
                  </View>
                  {mode !== null && (
                    <DateTimePicker
                      value={tempValue}
                      mode={mode === 'date' ? 'date' : 'time'}
                      display="spinner"
                      onChange={onChange}
                      style={styles.iosPicker}
                      textColor={colors.textMain}
                    />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          ) : (
            mode !== null && (
              <DateTimePicker
                value={tempValue}
                mode={mode === 'date' ? 'date' : 'time'}
                display="default"
                onChange={onChange}
                is24Hour
              />
            )
          )}

          <Modal visible={pickerSheet !== null} animationType="slide" transparent onRequestClose={() => setPickerSheet(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalBg} onPress={() => setPickerSheet(null)}>
              <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
                <Text style={styles.modalTitle}>
                  {pickerSheet === 'store' ? t('store_location') : t('work_shift')}
                </Text>
                {pickerSheet === 'store'
                  ? STORE_LOCATIONS.map(loc => (
                      <TouchableOpacity
                        key={loc}
                        style={styles.modalRow}
                        onPress={() => { setStoreLocation(loc); setPickerSheet(null); }}
                      >
                        <Text style={styles.modalRowText}>{loc}</Text>
                        {storeLocation === loc && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    ))
                  : SHIFT_PRESETS.map(p => (
                      <TouchableOpacity
                        key={p.type}
                        style={styles.modalRow}
                        onPress={() => onPickShiftType(p.type)}
                      >
                        <Text style={styles.modalRowText}>{t(`shift_${p.type}` as any)}  ·  {p.start} – {p.end}</Text>
                        {shiftType === p.type && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textMain },
  container: { padding: 20, paddingBottom: 50 },
  myShiftCard: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, padding: 14, marginBottom: 16 },
  cardLabel: { fontSize: 11, color: colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  cardLine: { fontSize: 14, fontWeight: '600', color: colors.textMain, marginTop: 4 },
  cardLineSmall: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMain, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: colors.primaryFg },
  section: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 8 },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 12, fontSize: 14, color: colors.textMain, minHeight: 60, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  peerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 8 },
  dateBox: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 18, fontWeight: '800', color: colors.textMain },
  dateMon: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  peerName: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  peerTime: { fontSize: 12, color: colors.textMain, marginTop: 2 },
  peerLoc: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  formCard: { backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: 16 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  fieldLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 15, fontWeight: '600', color: colors.textMain, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 12 },
  submit: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  submitText: { color: colors.primaryFg, fontWeight: '700', fontSize: 15 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textMain, marginBottom: 12 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowText: { fontSize: 14, color: colors.textMain },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  pickerCancel: { fontSize: 15, color: colors.textMuted, fontWeight: '500', minWidth: 60 },
  pickerDone: { fontSize: 15, color: colors.primary, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  iosPicker: { width: '100%', alignSelf: 'stretch' },
});
