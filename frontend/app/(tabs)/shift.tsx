import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, TextInput, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
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

type Mode = 'date' | 'start' | 'end' | null;

export default function ShiftScreen() {
  const { t } = useLang();
  const router = useRouter();
  const today = new Date();
  const in8 = new Date(today.getTime() + 8 * 3600 * 1000);
  const [date, setDate] = useState<Date>(today);
  const [start, setStart] = useState<Date>(today);
  const [end, setEnd] = useState<Date>(in8);
  const [note, setNote] = useState('');
  const [storeLocation, setStoreLocation] = useState<string>('');
  const [shiftType, setShiftType] = useState<'morning' | 'afternoon' | 'evening' | ''>('');
  const [picker, setPicker] = useState<null | 'store' | 'shiftType'>(null);
  const [mode, setMode] = useState<Mode>(null);
  // Buffer used by the popup picker to avoid mutating the field until "Done"
  const [tempValue, setTempValue] = useState<Date>(today);
  const [tempText, setTempText] = useState('');
  const [saving, setSaving] = useState(false);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await api.myShifts();
      setShifts(list);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openPicker = (m: Exclude<Mode, null>) => {
    const value = m === 'date' ? date : m === 'start' ? start : end;
    setTempValue(value);
    setTempText(m === 'date' ? fmtDate(value) : fmtTime(value));
    setMode(m);
  };

  const onChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      // Android: native dialog returns once with action either 'set' or 'dismissed'
      setMode(null);
      if (event?.type !== 'set' || !selected) return;
      if (mode === 'date') setDate(selected);
      if (mode === 'start') setStart(selected);
      if (mode === 'end') setEnd(selected);
      return;
    }
    // iOS: keep updating the temp buffer; commit on "Done"
    if (selected) setTempValue(selected);
  };

  const confirmPicker = () => {
    if (Platform.OS === 'web') {
      if (mode === 'date') {
        const match = tempText.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
          Alert.alert(t('failed'), t('invalid_date_format'));
          return;
        }
        const next = new Date(date);
        next.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        next.setHours(0, 0, 0, 0);
        if (Number.isNaN(next.getTime()) || fmtDate(next) !== tempText.trim()) {
          Alert.alert(t('failed'), t('invalid_date_format'));
          return;
        }
        setDate(next);
      }
      if (mode === 'start' || mode === 'end') {
        const match = tempText.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
        if (!match) {
          Alert.alert(t('failed'), t('invalid_time_format'));
          return;
        }
        const next = new Date(mode === 'start' ? start : end);
        next.setHours(Number(match[1]), Number(match[2]), 0, 0);
        if (mode === 'start') setStart(next);
        if (mode === 'end') setEnd(next);
      }
      setMode(null);
      return;
    }
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
    setPicker(null);
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.createShift(fmtDate(date), fmtTime(start), fmtTime(end), note, storeLocation, shiftType);
      setNote('');
      Alert.alert(t('shift_registered'), t('shift_saved'));
      load();
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeShift = async (id: string) => {
    Alert.alert(t('delete_shift'), t('cannot_be_undone'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => { try { await api.deleteShift(id); load(); } catch (e: any) { Alert.alert(t('failed'), e.message); } } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="shift-screen">
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('register_shift')}</Text>
        <Text style={styles.sub}>{t('register_shift_sub')}</Text>

        <View style={styles.card}>
          <TouchableOpacity style={styles.field} onPress={() => openPicker('date')} testID="shift-date">
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t('date')}</Text>
              <Text style={styles.fieldValue}>{date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.field} onPress={() => openPicker('start')} testID="shift-start">
            <Ionicons name="play-circle" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t('start_time')}</Text>
              <Text style={styles.fieldValue}>{fmtTime(start)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.field} onPress={() => openPicker('end')} testID="shift-end">
            <Ionicons name="stop-circle" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t('end_time')}</Text>
              <Text style={styles.fieldValue}>{fmtTime(end)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.field} onPress={() => setPicker('shiftType')} testID="shift-type">
            <Ionicons name="time" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t('work_shift')}</Text>
              <Text style={styles.fieldValue}>
                {shiftType ? t(`shift_${shiftType}` as any) : t('shift_custom')}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.field} onPress={() => setPicker('store')} testID="store-location">
            <Ionicons name="storefront" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t('store_location')}</Text>
              <Text style={[styles.fieldValue, !storeLocation && { color: colors.textLight }]} numberOfLines={1}>
                {storeLocation || t('select_store')}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        <TextInput
          testID="shift-note"
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder={t('note_optional')}
          placeholderTextColor={colors.textLight}
        />

        <TouchableOpacity style={styles.submit} onPress={submit} disabled={saving} testID="shift-submit">
          {saving ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.submitText}>{t('register_shift')}</Text>}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('your_shifts')}</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : shifts.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t('no_shifts')}</Text></View>
        ) : (
          shifts.map((s) => (
            <View key={s.id} style={styles.shiftRow} testID={`shift-item-${s.id}`}>
              <View style={styles.shiftDateBox}>
                <Text style={styles.shiftDay}>{new Date(s.date).getDate()}</Text>
                <Text style={styles.shiftMonth}>{new Date(s.date).toLocaleDateString([], { month: 'short' }).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shiftTime}>
                  {s.start_time} – {s.end_time}
                  {s.shift_type ? `  •  ${t(`shift_${s.shift_type}` as any)}` : ''}
                </Text>
                {s.store_location ? <Text style={styles.shiftStore} numberOfLines={1}>📍 {s.store_location}</Text> : null}
                {s.note ? <Text style={styles.shiftNote}>{s.note}</Text> : null}
                <View style={{ marginTop: 6 }}>
                  <ApprovalBadge status={s.approval_status} />
                </View>
                {s.approval_status === 'rejected' && s.rejected_reason ? (
                  <Text style={styles.rejectReason} numberOfLines={2}>“{s.rejected_reason}”</Text>
                ) : null}
              </View>
              {s.approval_status === 'approved' ? (
                <View style={styles.actionsCol}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/swap-from/[id]', params: { id: s.id } })}
                    style={styles.swapBtn}
                    testID={`shift-swap-${s.id}`}
                  >
                    <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.lockedBox} testID={`shift-locked-${s.id}`}>
                    <Ionicons name="lock-closed" size={16} color={colors.success} />
                  </View>
                </View>
              ) : (
                <View style={styles.actionsCol}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/swap-from/[id]', params: { id: s.id } })}
                    style={styles.swapBtn}
                    testID={`shift-swap-${s.id}`}
                  >
                    <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/shift-edit/[id]', params: { id: s.id } })}
                    style={styles.editBtn}
                    testID={`shift-edit-${s.id}`}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeShift(s.id)} style={styles.deleteBtn} testID={`shift-delete-${s.id}`}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

        {/* Web: text modal; iOS: popup bottom-sheet picker; Android: native dialog */}
        {Platform.OS === 'web' ? (
          <Modal
            visible={mode !== null}
            animationType="fade"
            transparent
            onRequestClose={cancelPicker}
            testID="datetime-picker-modal"
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalBg} onPress={cancelPicker}>
              <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={cancelPicker} testID="picker-cancel">
                    <Text style={styles.pickerCancel}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>
                    {mode === 'date' ? t('date') : mode === 'start' ? t('start_time') : t('end_time')}
                  </Text>
                  <TouchableOpacity onPress={confirmPicker} testID="picker-done">
                    <Text style={styles.pickerDone}>{t('done')}</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  testID="web-datetime-input"
                  style={styles.webPickerInput}
                  value={tempText}
                  onChangeText={setTempText}
                  placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm'}
                  placeholderTextColor={colors.textLight}
                  autoFocus
                />
                <Text style={styles.webPickerHint}>
                  {mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        ) : Platform.OS === 'ios' ? (
          <Modal
            visible={mode !== null}
            animationType="slide"
            transparent
            onRequestClose={cancelPicker}
            testID="datetime-picker-modal"
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalBg} onPress={cancelPicker}>
              <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={cancelPicker} testID="picker-cancel">
                    <Text style={styles.pickerCancel}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>
                    {mode === 'date' ? t('date') : mode === 'start' ? t('start_time') : t('end_time')}
                  </Text>
                  <TouchableOpacity onPress={confirmPicker} testID="picker-done">
                    <Text style={styles.pickerDone}>{t('done')}</Text>
                  </TouchableOpacity>
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

        <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBg} onPress={() => setPicker(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {picker === 'store' ? t('select_store') : t('select_shift_type')}
              </Text>
              {picker === 'shiftType' ? (
                <FlatList
                  data={SHIFT_PRESETS}
                  keyExtractor={(it) => it.type}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      testID={`opt-shift-${item.type}`}
                      style={[styles.optRow, shiftType === item.type && styles.optRowActive]}
                      onPress={() => onPickShiftType(item.type)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optLabel}>{t(`shift_${item.type}` as any)}</Text>
                        <Text style={styles.optSub}>{item.start} – {item.end}</Text>
                      </View>
                      {shiftType === item.type && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <FlatList
                  data={STORE_LOCATIONS}
                  keyExtractor={(it) => it}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      testID={`opt-store-${item}`}
                      style={[styles.optRow, storeLocation === item && styles.optRowActive]}
                      onPress={() => { setStoreLocation(item); setPicker(null); }}
                    >
                      <Ionicons name="storefront-outline" size={18} color={colors.primary} />
                      <Text style={[styles.optLabel, { flex: 1, marginLeft: 10 }]}>{item}</Text>
                      {storeLocation === item && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                    </TouchableOpacity>
                  )}
                />
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: colors.background, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { color: colors.textMain, fontSize: 16, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  input: {
    marginTop: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 14, fontSize: 16, color: colors.textMain,
  },
  submit: {
    marginTop: 20, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitText: { color: colors.primaryFg, fontWeight: '700', fontSize: 16 },
  sectionTitle: { marginTop: 32, marginBottom: 12, fontSize: 18, fontWeight: '700', color: colors.textMain },
  empty: { backgroundColor: colors.background, padding: 24, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textMuted },
  shiftRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.background,
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  shiftDateBox: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  shiftDay: { fontSize: 20, fontWeight: '800', color: colors.primary },
  shiftMonth: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  shiftTime: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  shiftStore: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 3 },
  shiftNote: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rejectReason: { fontSize: 11, color: colors.error, fontStyle: 'italic', marginTop: 4 },
  lockedBox: { padding: 8, backgroundColor: '#D1FAE5', borderRadius: 999 },
  actionsCol: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swapBtn: { padding: 8, backgroundColor: '#FEF3C7', borderRadius: 999 },
  editBtn: { padding: 8, backgroundColor: '#EFF6FF', borderRadius: 999 },
  deleteBtn: { padding: 8 },
  doneBtn: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 999 },
  doneText: { color: colors.primaryFg, fontWeight: '700' },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 10, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  pickerCancel: { fontSize: 15, color: colors.textMuted, fontWeight: '500', minWidth: 60 },
  pickerDone: { fontSize: 15, color: colors.primary, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  iosPicker: { width: '100%', alignSelf: 'stretch' },
  webPickerInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 18,
    fontWeight: '700', color: colors.textMain, backgroundColor: colors.surface,
  },
  webPickerHint: { color: colors.textMuted, fontSize: 12, marginTop: 8, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textMain, marginBottom: 12 },
  optRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  optRowActive: { backgroundColor: '#EFF6FF' },
  optLabel: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  optSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
