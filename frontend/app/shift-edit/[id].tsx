import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function parseTime(date: Date, t: string) {
  const [h, m] = t.split(':').map(n => parseInt(n, 10));
  const x = new Date(date);
  x.setHours(h || 0, m || 0, 0, 0);
  return x;
}

export default function ShiftEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLang();
  const [shift, setShift] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [start, setStart] = useState<Date>(new Date());
  const [end, setEnd] = useState<Date>(new Date());
  const [note, setNote] = useState('');
  const [assignTo, setAssignTo] = useState<string | null>(null);
  const [mode, setMode] = useState<'date' | 'start' | 'end' | null>(null);
  const [tempValue, setTempValue] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const list = await api.allShifts();
      const s = list.find((x: any) => x.id === id);
      if (!s) { Alert.alert(t('failed'), 'Not found'); router.back(); return; }
      setShift(s);
      setDate(new Date(s.date + 'T00:00:00'));
      setStart(parseTime(new Date(s.date + 'T00:00:00'), s.start_time));
      setEnd(parseTime(new Date(s.date + 'T00:00:00'), s.end_time));
      setNote(s.note || '');
      setAssignTo(s.user_id);
      if (isAdmin) {
        const emps = await api.adminEmployees();
        setEmployees(emps);
      }
    } catch (e: any) { Alert.alert(t('failed'), e.message); }
    setLoading(false);
  }, [id, isAdmin, router, t]);

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

  const save = async () => {
    if (!shift) return;
    const isOwner = shift.user_id === user?.id;
    setSaving(true);
    try {
      const body: any = {
        date: fmtDate(date),
        start_time: fmtTime(start),
        end_time: fmtTime(end),
        note,
        store_location: shift.store_location || '',
        shift_type: shift.shift_type || '',
      };
      if (isAdmin) {
        body.user_id = assignTo;
        await api.adminUpdateShift(shift.id, body);
      } else if (isOwner) {
        // Employee owner: full PATCH that preserves the same shift id
        // and re-queues for admin approval.
        await api.updateMyShift(shift.id, body);
      } else {
        Alert.alert(t('failed'), 'Not allowed');
        setSaving(false);
        return;
      }
      Alert.alert(t('saved'));
      router.back();
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert(t('delete_shift'), t('cannot_be_undone'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        try {
          if (isAdmin) await api.adminDeleteShift(shift.id);
          else await api.deleteShift(shift.id);
          router.back();
        } catch (e: any) { Alert.alert(t('failed'), e.message); }
      } },
    ]);
  };

  if (loading || !shift) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="shift-edit-screen">
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('edit_shift')}</Text>
        <TouchableOpacity onPress={remove} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.field} onPress={() => openPicker('date')}>
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
        </View>

        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder={t('note_optional')}
          placeholderTextColor={colors.textLight}
        />

        {isAdmin && (
          <>
            <Text style={styles.label}>{t('assign_to')}</Text>
            <View style={styles.empList}>
              {employees.map((e: any) => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.empRow, assignTo === e.id && styles.empRowActive]}
                  onPress={() => setAssignTo(e.id)}
                  testID={`assign-${e.id}`}
                >
                  <View style={styles.empAvatar}><Text style={styles.empAvatarText}>{(e.name || e.email).charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>{e.name || '—'}</Text>
                    <Text style={styles.empEmail}>{e.email}</Text>
                  </View>
                  {assignTo === e.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.submit} onPress={save} disabled={saving} testID="save-shift">
          {saving ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.submitText}>{t('save_changes')}</Text>}
        </TouchableOpacity>

        {Platform.OS === 'ios' ? (
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textMain },
  container: { padding: 20, paddingBottom: 60 },
  card: { backgroundColor: colors.background, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { color: colors.textMain, fontSize: 16, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  input: { marginTop: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, fontSize: 16, color: colors.textMain },
  label: { marginTop: 22, marginBottom: 10, fontWeight: '700', fontSize: 15, color: colors.textMain },
  empList: { backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  empRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  empRowActive: { backgroundColor: '#EFF6FF' },
  empAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  empAvatarText: { color: colors.primaryFg, fontWeight: '700' },
  empName: { fontWeight: '700', color: colors.textMain },
  empEmail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  submit: { marginTop: 24, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: colors.primaryFg, fontWeight: '700', fontSize: 16 },
  doneBtn: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 999 },
  doneText: { color: colors.primaryFg, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 10, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  pickerCancel: { fontSize: 15, color: colors.textMuted, fontWeight: '500', minWidth: 60 },
  pickerDone: { fontSize: 15, color: colors.primary, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  iosPicker: { width: '100%', alignSelf: 'stretch' },
});
