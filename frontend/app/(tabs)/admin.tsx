import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';
import { SHIFT_PRESETS, STORE_LOCATIONS } from '../../src/shift-options';
import NotificationBell from '../../src/components/NotificationBell';

function fmtDt(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function roleLabel(role: string | undefined, t: (key: any) => string) {
  if (role === 'admin' || role === 'owner') return t('role_owner');
  if (role === 'manager') return t('role_manager');
  return t('role_employee');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localIso(date: string, time: string) {
  if (!date || !time) return undefined;
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function localTimeFromIso(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function localDateFromIso(iso?: string | null) {
  if (!iso) return todayStr();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayStr();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftTypeLabel(type?: string) {
  if (type === 'morning') return 'Ca sáng';
  if (type === 'afternoon') return 'Ca chiều';
  if (type === 'evening') return 'Ca tối';
  return 'Tuỳ chọn';
}

export default function Admin() {
  const { t } = useLang();
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [pendingSwaps, setPendingSwaps] = useState<number>(0);
  const [pendingShifts, setPendingShifts] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleTarget, setRoleTarget] = useState<any>(null);
  const [draftRole, setDraftRole] = useState<'employee' | 'manager' | 'owner'>('employee');
  const [draftStore, setDraftStore] = useState(STORE_LOCATIONS[0]);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleMessage, setRoleMessage] = useState('');
  const [workbench, setWorkbench] = useState<'attendance' | 'shift' | 'task'>('attendance');
  const managerStore = user?.role === 'manager' ? (user.store_location || STORE_LOCATIONS[0]) : '';
  const defaultStore = managerStore || STORE_LOCATIONS[0];
  const [attendanceEditing, setAttendanceEditing] = useState<any>(null);
  const [attendanceUserId, setAttendanceUserId] = useState('');
  const [attendanceStore, setAttendanceStore] = useState(defaultStore);
  const [attendanceDate, setAttendanceDate] = useState(todayStr());
  const [attendanceIn, setAttendanceIn] = useState('08:30');
  const [attendanceOut, setAttendanceOut] = useState('');
  const [attendanceNote, setAttendanceNote] = useState('');
  const [shiftUserId, setShiftUserId] = useState('');
  const [shiftStore, setShiftStore] = useState(defaultStore);
  const [shiftDate, setShiftDate] = useState(todayStr());
  const [shiftStart, setShiftStart] = useState('08:30');
  const [shiftEnd, setShiftEnd] = useState('12:30');
  const [shiftType, setShiftType] = useState('morning');
  const [shiftNote, setShiftNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStore, setTaskStore] = useState(defaultStore);
  const [taskUserId, setTaskUserId] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, e, a, sh, sw, ps, tk] = await Promise.all([
        api.adminStats(), api.adminEmployees(), api.adminAttendance(), api.adminShifts(), api.adminListSwaps(), api.adminPendingShifts(), api.adminTasks(),
      ]);
      setStats(s); setEmployees(e); setAttendance(a); setShifts(sh); setTasks(tk || []);
      setPendingSwaps((sw || []).filter((x: any) => x.status === 'pending').length);
      setPendingShifts((ps || []).length);
      if (!attendanceUserId && e?.[0]?.id) setAttendanceUserId(e[0].id);
      if (!shiftUserId && e?.[0]?.id) setShiftUserId(e[0].id);
      if (!taskUserId && user?.role === 'manager' && e?.[0]?.id) setTaskUserId(e[0].id);
    } catch (err) {
      console.log('admin load err', err);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const isOwner = user?.role === 'owner' || user?.role === 'admin';
  const selectableStores = isOwner ? STORE_LOCATIONS : [defaultStore];
  const employeeOptions = employees.filter((e) => e.role !== 'admin' && e.role !== 'owner');
  const taskEmployeeOptions = employeeOptions.filter((e) => !taskStore || !e.store_location || e.store_location === taskStore || shifts.some((s) => s.user_id === e.id && s.store_location === taskStore));

  const updateRole = async (target: any, role: 'employee' | 'manager' | 'owner', storeLocation = '') => {
    const store = role === 'manager' ? storeLocation : '';
    try {
      const updated = await api.adminUpdateUserRole(target.id, role, store);
      setEmployees((rows) => rows.map((row) => row.id === target.id ? updated : row));
      await load();
      if (target.id === user?.id) await refresh();
      return updated;
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
      setRoleMessage(e.message || t('failed'));
      return null;
    }
  };

  const openRoleEditor = (target: any) => {
    setRoleTarget(target);
    const normalizedRole = target.role === 'admin' || target.role === 'owner'
      ? 'owner'
      : target.role === 'manager'
        ? 'manager'
        : 'employee';
    setDraftRole(normalizedRole);
    setDraftStore(target.store_location || STORE_LOCATIONS[0]);
    setRoleMessage('');
  };

  const closeRoleEditor = () => setRoleTarget(null);

  const saveRoleEditor = async () => {
    if (!roleTarget || roleSaving) return;
    setRoleSaving(true);
    setRoleMessage(t('saving'));
    const updated = await updateRole(roleTarget, draftRole, draftRole === 'manager' ? draftStore : '');
    setRoleSaving(false);
    if (updated) {
      setRoleMessage(`${t('saved')}: ${roleLabel(updated.role, t)}${updated.store_location ? ` - ${updated.store_location}` : ''}`);
      setTimeout(closeRoleEditor, 700);
    }
  };

  const resetAttendanceForm = () => {
    setAttendanceEditing(null);
    setAttendanceDate(todayStr());
    setAttendanceIn('08:30');
    setAttendanceOut('');
    setAttendanceNote('');
    setAttendanceStore(defaultStore);
  };

  const editAttendance = (record: any) => {
    setWorkbench('attendance');
    setAttendanceEditing(record);
    setAttendanceUserId(record.user_id || attendanceUserId);
    setAttendanceStore(record.store_location || defaultStore);
    setAttendanceDate(record.check_in_local_date || localDateFromIso(record.check_in));
    setAttendanceIn(record.check_in_local_time || localTimeFromIso(record.check_in) || '08:30');
    setAttendanceOut(record.check_out_local_time || localTimeFromIso(record.check_out));
    setAttendanceNote(record.note || '');
  };

  const saveAttendance = async () => {
    if (!attendanceUserId) return Alert.alert(t('failed'), 'Chọn nhân viên');
    if (!attendanceDate || !attendanceIn) return Alert.alert(t('failed'), 'Nhập ngày và giờ vào');
    const checkIn = localIso(attendanceDate, attendanceIn);
    const checkOut = attendanceOut ? localIso(attendanceDate, attendanceOut) : null;
    if (!checkIn || (attendanceOut && !checkOut)) return Alert.alert(t('failed'), 'Ngày/giờ không hợp lệ');
    setActionSaving(true);
    try {
      const body = {
        user_id: attendanceUserId,
        store_location: attendanceStore,
        check_in: checkIn,
        check_out: checkOut,
        check_in_local_date: attendanceDate,
        check_in_local_time: attendanceIn,
        check_out_local_time: attendanceOut || undefined,
        note: attendanceNote,
      };
      if (attendanceEditing) await api.adminUpdateAttendance(attendanceEditing.id, body);
      else await api.adminCreateAttendance(body);
      resetAttendanceForm();
      await load();
      Alert.alert(t('saved'));
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setActionSaving(false);
    }
  };

  const setPreset = (preset: any) => {
    setShiftType(preset.type);
    setShiftStart(preset.start);
    setShiftEnd(preset.end);
  };

  const saveAdminShift = async () => {
    if (!shiftUserId) return Alert.alert(t('failed'), 'Chọn nhân viên');
    if (!shiftDate || !shiftStart || !shiftEnd) return Alert.alert(t('failed'), 'Nhập đủ ngày giờ');
    setActionSaving(true);
    try {
      await api.adminCreateShift({
        user_id: shiftUserId,
        date: shiftDate,
        start_time: shiftStart,
        end_time: shiftEnd,
        store_location: shiftStore,
        shift_type: shiftType,
        note: shiftNote,
      });
      setShiftNote('');
      await load();
      Alert.alert(t('saved'));
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setActionSaving(false);
    }
  };

  const saveTask = async () => {
    if (!taskTitle.trim()) return Alert.alert(t('failed'), 'Nhập tên task');
    if (user?.role === 'manager' && !taskUserId) return Alert.alert(t('failed'), 'Quản lý cần chọn nhân viên nhận task');
    setActionSaving(true);
    try {
      await api.adminCreateTask({
        title: taskTitle.trim(),
        description: taskDesc,
        store_location: taskStore,
        assigned_user_id: taskUserId || null,
      });
      setTaskTitle('');
      setTaskDesc('');
      if (user?.role !== 'manager') setTaskUserId('');
      await load();
      Alert.alert(t('saved'));
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setActionSaving(false);
    }
  };

  const quickAction = async (fn: () => Promise<any>) => {
    setActionSaving(true);
    try {
      await fn();
      await load();
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setActionSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="admin-screen">
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('admin_dashboard')}</Text>
            <Text style={styles.sub}>{t('admin_sub')}</Text>
          </View>
          <NotificationBell />
        </View>

        <TouchableOpacity
          testID="admin-approvals-link"
          style={[styles.swapCta, styles.approveCta]}
          onPress={() => router.push('/admin-approvals')}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-done-circle" size={20} color="#92400E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.approveCtaTitle}>{t('pending_shifts')}</Text>
            <Text style={styles.approveCtaSub}>
              {pendingShifts > 0 ? `${pendingShifts} ${t('pending_approval').toLowerCase()}` : t('no_pending_shifts')}
            </Text>
          </View>
          {pendingShifts > 0 && (
            <View style={styles.approveBadge}>
              <Text style={styles.approveBadgeText}>{pendingShifts}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#92400E" />
        </TouchableOpacity>

        <TouchableOpacity
          testID="admin-swaps-link"
          style={styles.swapCta}
          onPress={() => router.push('/admin-swaps')}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.primaryFg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.swapCtaTitle}>{t('swap_requests_admin')}</Text>
            <Text style={styles.swapCtaSub}>
              {pendingSwaps > 0 ? `${pendingSwaps} ${t('pending')}` : t('no_swaps_pending')}
            </Text>
          </View>
          {pendingSwaps > 0 && (
            <View style={styles.swapBadge}>
              <Text style={styles.swapBadgeText}>{pendingSwaps}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.primaryFg} />
        </TouchableOpacity>

        <View style={styles.statsGrid}>
          <StatCard icon="people" label={t('employees')} value={stats?.total_employees ?? 0} />
          <StatCard icon="pulse" label={t('active_now')} value={stats?.active_now ?? 0} accent />
          <StatCard icon="calendar" label={t('shifts_today')} value={stats?.shifts_today ?? 0} />
          <StatCard icon="time" label={t('total_shifts')} value={stats?.total_shifts ?? 0} />
        </View>

        <Text style={styles.sectionTitle}>Bàn thao tác quản trị</Text>
        <View style={styles.workbench}>
          <View style={styles.segment}>
            {([
              ['attendance', 'Chấm công', 'finger-print'],
              ['shift', 'Xếp ca', 'calendar-number'],
              ['task', 'Task', 'checkbox'],
            ] as const).map(([key, label, icon]) => (
              <TouchableOpacity
                key={key}
                style={[styles.segmentBtn, workbench === key && styles.segmentBtnActive]}
                onPress={() => setWorkbench(key)}
                testID={`admin-workbench-${key}`}
              >
                <Ionicons name={icon as any} size={16} color={workbench === key ? colors.primaryFg : colors.textMuted} />
                <Text style={[styles.segmentText, workbench === key && styles.segmentTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {workbench === 'attendance' ? (
            <View style={styles.toolPanel} testID="attendance-workbench">
              <Text style={styles.toolTitle}>{attendanceEditing ? 'Sửa chấm công' : 'Tạo chấm công'}</Text>
              <PersonPicker value={attendanceUserId} onChange={setAttendanceUserId} people={employeeOptions} />
              <StorePicker stores={selectableStores} value={attendanceStore} onChange={setAttendanceStore} />
              <View style={styles.formGrid}>
                <FormInput label={t('date')} value={attendanceDate} onChangeText={setAttendanceDate} placeholder="YYYY-MM-DD" />
                <FormInput label={t('in')} value={attendanceIn} onChangeText={setAttendanceIn} placeholder="08:30" />
                <FormInput label={t('out')} value={attendanceOut} onChangeText={setAttendanceOut} placeholder="12:30" />
              </View>
              <TextInput
                style={styles.formInput}
                value={attendanceNote}
                onChangeText={setAttendanceNote}
                placeholder={t('note_optional')}
                placeholderTextColor={colors.textLight}
              />
              <View style={styles.inlineActions}>
                {attendanceEditing ? (
                  <TouchableOpacity style={styles.secondaryBtn} onPress={resetAttendanceForm} disabled={actionSaving}>
                    <Text style={styles.secondaryBtnText}>{t('cancel')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.primaryBtn} onPress={saveAttendance} disabled={actionSaving} testID="admin-save-attendance">
                  {actionSaving ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.primaryBtnText}>{attendanceEditing ? t('save_changes') : 'Tạo chấm công'}</Text>}
                </TouchableOpacity>
              </View>

              <Text style={styles.listTitle}>Chấm công gần nhất</Text>
              {attendance.slice(0, 5).map((r) => (
                <View key={r.id} style={styles.toolRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{r.user_name || r.user_email}</Text>
                    <Text style={styles.rowSub}>{r.store_location || '—'} • {t('in')} {fmtDt(r.check_in)} • {t('out')} {fmtDt(r.check_out)}</Text>
                    <Text style={styles.rowSub}>{r.approval_status || 'pending'} {r.duration_minutes != null ? `• ${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m` : ''}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <IconAction icon="create-outline" label={t('edit')} onPress={() => editAttendance(r)} />
                    {r.approval_status !== 'approved' ? <IconAction icon="checkmark" label={t('approve')} onPress={() => quickAction(() => api.adminApproveAttendance(r.id))} /> : null}
                    {r.approval_status !== 'rejected' ? <IconAction icon="close" label={t('reject')} danger onPress={() => quickAction(() => api.adminRejectAttendance(r.id))} /> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {workbench === 'shift' ? (
            <View style={styles.toolPanel} testID="shift-workbench">
              <Text style={styles.toolTitle}>Xếp ca làm</Text>
              <PersonPicker value={shiftUserId} onChange={setShiftUserId} people={employeeOptions} />
              <StorePicker stores={selectableStores} value={shiftStore} onChange={setShiftStore} />
              <View style={styles.presetRow}>
                {SHIFT_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.type}
                    style={[styles.presetBtn, shiftType === preset.type && styles.presetBtnActive]}
                    onPress={() => setPreset(preset)}
                  >
                    <Text style={[styles.presetText, shiftType === preset.type && styles.presetTextActive]}>{shiftTypeLabel(preset.type)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.formGrid}>
                <FormInput label={t('date')} value={shiftDate} onChangeText={setShiftDate} placeholder="YYYY-MM-DD" />
                <FormInput label={t('start_time')} value={shiftStart} onChangeText={setShiftStart} placeholder="08:30" />
                <FormInput label={t('end_time')} value={shiftEnd} onChangeText={setShiftEnd} placeholder="12:30" />
              </View>
              <TextInput
                style={styles.formInput}
                value={shiftNote}
                onChangeText={setShiftNote}
                placeholder={t('note_optional')}
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={saveAdminShift} disabled={actionSaving} testID="admin-create-shift">
                {actionSaving ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.primaryBtnText}>Tạo ca đã duyệt</Text>}
              </TouchableOpacity>

              <Text style={styles.listTitle}>Ca gần nhất</Text>
              {shifts.slice(0, 5).map((s) => (
                <TouchableOpacity key={s.id} style={styles.toolRow} onPress={() => router.push(`/shift-edit/${s.id}` as any)}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{s.user_name || s.user_email}</Text>
                    <Text style={styles.rowSub}>{s.store_location || '—'} • {s.date} • {s.start_time}–{s.end_time}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {workbench === 'task' ? (
            <View style={styles.toolPanel} testID="task-workbench">
              <Text style={styles.toolTitle}>Tạo task công việc</Text>
              <StorePicker stores={selectableStores} value={taskStore} onChange={setTaskStore} />
              <TextInput
                style={styles.formInput}
                value={taskTitle}
                onChangeText={setTaskTitle}
                placeholder="Tên công việc"
                placeholderTextColor={colors.textLight}
              />
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={taskDesc}
                onChangeText={setTaskDesc}
                placeholder="Mô tả / yêu cầu"
                placeholderTextColor={colors.textLight}
                multiline
              />
              <Text style={styles.fieldCaption}>{user?.role === 'manager' ? 'Chọn nhân viên nhận task' : 'Bỏ trống người nhận để giao task cho quản lý cửa hàng'}</Text>
              <PersonPicker value={taskUserId} onChange={setTaskUserId} people={taskEmployeeOptions} allowEmpty={user?.role !== 'manager'} emptyLabel="Task cho cửa hàng" />
              <TouchableOpacity style={styles.primaryBtn} onPress={saveTask} disabled={actionSaving} testID="admin-create-task">
                {actionSaving ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.primaryBtnText}>Tạo task</Text>}
              </TouchableOpacity>

              <Text style={styles.listTitle}>Task gần nhất</Text>
              {tasks.slice(0, 6).map((task) => (
                <View key={task.id} style={styles.toolRow}>
                  <View style={[styles.dot, { backgroundColor: task.status === 'completed' ? colors.success : colors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{task.title}</Text>
                    <Text style={styles.rowSub}>{task.store_location} • {task.assigned_user_name || 'Task cửa hàng'} • {task.status}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    {task.status !== 'completed' ? <IconAction icon="checkmark-done" label={t('completed')} onPress={() => quickAction(() => api.completeTask(task.id))} /> : null}
                    <IconAction icon="trash-outline" label={t('delete')} danger onPress={() => quickAction(() => api.adminDeleteTask(task.id))} />
                  </View>
                </View>
              ))}
              {tasks.length === 0 && <EmptyBox text="Chưa có task" />}
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{t('live_activity')}</Text>
        {attendance.slice(0, 8).map((r) => (
          <View key={r.id} style={styles.row} testID={`admin-attendance-${r.id}`}>
            <View style={[styles.dot, { backgroundColor: r.check_out ? colors.textLight : colors.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.user_name || r.user_email}</Text>
              <Text style={styles.rowSub}>{t('in')} {fmtDt(r.check_in)} • {t('out')} {fmtDt(r.check_out)}</Text>
              {r.check_in_address ? (
                <Text style={styles.rowSub} numberOfLines={2}>
                  <Ionicons name="location" size={11} color={colors.textLight} /> {r.check_in_address}
                </Text>
              ) : null}
            </View>
            <Text style={styles.badge}>
              {r.duration_minutes != null ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m` : t('active')}
            </Text>
          </View>
        ))}
        {attendance.length === 0 && <EmptyBox text={t('no_attendance')} />}

        <Text style={styles.sectionTitle}>{t('employees')} ({employees.length})</Text>
        {employees.map((u) => (
          <View key={u.id} style={styles.row} testID={`admin-employee-${u.id}`}>
            <View style={styles.miniAvatar}>
              <Text style={styles.miniAvatarText}>{(u.name || u.email).charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{u.name || '—'}</Text>
              <Text style={styles.rowSub}>{u.email}</Text>
              {u.store_location ? <Text style={styles.rowSub}>📍 {u.store_location}</Text> : null}
            </View>
            <View style={styles.roleBox}>
              <View style={[styles.roleTag, (u.role === 'admin' || u.role === 'owner' || u.role === 'manager') && styles.roleTagAdmin]}>
                <Text style={[styles.roleTagText, (u.role === 'admin' || u.role === 'owner' || u.role === 'manager') && styles.roleTagTextAdmin]}>
                  {roleLabel(u.role, t)}
                </Text>
              </View>
              {isOwner && u.id !== user?.id ? (
                <View style={styles.roleActions}>
                  <TouchableOpacity style={styles.roleActionBtn} onPress={() => openRoleEditor(u)} testID={`role-edit-${u.id}`}>
                    <Text style={styles.roleActionText}>{t('manage_role')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>{t('upcoming_shifts')}</Text>
        {shifts.slice(0, 10).map((s) => (
          <View key={s.id} style={styles.row} testID={`admin-shift-${s.id}`}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{s.user_name || s.user_email}</Text>
              <Text style={styles.rowSub}>{s.date}  •  {s.start_time}–{s.end_time}</Text>
            </View>
          </View>
        ))}
        {shifts.length === 0 && <EmptyBox text={t('no_shifts_registered')} />}
      </ScrollView>
      <Modal visible={!!roleTarget} animationType="slide" transparent onRequestClose={closeRoleEditor}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('manage_role')}</Text>
            {roleTarget ? <Text style={styles.modalSub}>{roleTarget.name || roleTarget.email}</Text> : null}

            <Text style={styles.modalLabel}>{t('role')}</Text>
            <View style={styles.roleChoiceRow}>
              {([
                ['employee', t('role_employee')],
                ['manager', t('role_manager')],
                ['owner', t('role_owner')],
              ] as const).map(([role, label]) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleChoice, draftRole === role && styles.roleChoiceActive]}
                  onPress={() => setDraftRole(role)}
                  testID={`role-choice-${role}`}
                  disabled={roleSaving}
                >
                  <Text style={[styles.roleChoiceText, draftRole === role && styles.roleChoiceTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {draftRole === 'manager' ? (
              <>
                <Text style={styles.modalLabel}>{t('store_location')}</Text>
                <ScrollView style={styles.storePicker}>
                  {STORE_LOCATIONS.map((store) => (
                    <TouchableOpacity
                      key={store}
                      style={[styles.storeChoice, draftStore === store && styles.storeChoiceActive]}
                      onPress={() => setDraftStore(store)}
                      testID={`manager-store-${store}`}
                      disabled={roleSaving}
                    >
                      <Ionicons
                        name={draftStore === store ? 'checkmark-circle' : 'storefront-outline'}
                        size={18}
                        color={draftStore === store ? colors.primary : colors.textMuted}
                      />
                      <Text style={[styles.storeChoiceText, draftStore === store && styles.storeChoiceTextActive]}>{store}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {roleMessage ? <Text style={styles.roleMessage}>{roleMessage}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeRoleEditor} disabled={roleSaving}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, roleSaving && styles.modalSaveBtnDisabled]} onPress={saveRoleEditor} testID="role-save" disabled={roleSaving}>
                {roleSaving ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.modalSaveText}>{t('save_changes')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FormInput({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
      />
    </View>
  );
}

function PersonPicker({ value, onChange, people, allowEmpty, emptyLabel }: { value: string; onChange: (v: string) => void; people: any[]; allowEmpty?: boolean; emptyLabel?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroller}>
      {allowEmpty ? (
        <TouchableOpacity style={[styles.pickChip, !value && styles.pickChipActive]} onPress={() => onChange('')}>
          <Ionicons name="storefront-outline" size={14} color={!value ? colors.primaryFg : colors.textMuted} />
          <Text style={[styles.pickChipText, !value && styles.pickChipTextActive]}>{emptyLabel || 'Không chọn'}</Text>
        </TouchableOpacity>
      ) : null}
      {people.map((person) => (
        <TouchableOpacity
          key={person.id}
          style={[styles.pickChip, value === person.id && styles.pickChipActive]}
          onPress={() => onChange(person.id)}
          testID={`pick-person-${person.id}`}
        >
          <Text style={[styles.pickChipText, value === person.id && styles.pickChipTextActive]} numberOfLines={1}>
            {person.name || person.email}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function StorePicker({ stores, value, onChange }: { stores: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroller}>
      {stores.map((store) => (
        <TouchableOpacity
          key={store}
          style={[styles.pickChip, value === store && styles.pickChipActive]}
          onPress={() => onChange(store)}
          testID={`pick-store-${store}`}
        >
          <Ionicons name="location-outline" size={14} color={value === store ? colors.primaryFg : colors.textMuted} />
          <Text style={[styles.pickChipText, value === store && styles.pickChipTextActive]} numberOfLines={1}>{store}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function IconAction({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={[styles.iconAction, danger && styles.iconActionDanger]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={danger ? colors.error : colors.primary} />
      <Text style={[styles.iconActionText, danger && styles.iconActionTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ icon, label, value, accent }: any) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Ionicons name={icon} size={18} color={accent ? colors.primaryFg : colors.primary} />
      <Text style={[styles.statValue, accent && { color: colors.primaryFg }]}>{value}</Text>
      <Text style={[styles.statLabel, accent && { color: 'rgba(255,255,255,0.8)' }]}>{label}</Text>
    </View>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  swapCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primary, borderRadius: 16, padding: 14, marginBottom: 16,
  },
  swapCtaTitle: { color: colors.primaryFg, fontSize: 14, fontWeight: '700' },
  swapCtaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  swapBadge: { backgroundColor: '#fff', minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  swapBadgeText: { color: colors.primary, fontWeight: '800', fontSize: 11 },
  approveCta: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
  approveCtaTitle: { color: '#92400E', fontSize: 14, fontWeight: '700' },
  approveCtaSub: { color: '#92400E', fontSize: 12, marginTop: 2, opacity: 0.85 },
  approveBadge: { backgroundColor: '#92400E', minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  approveBadgeText: { color: '#FEF3C7', fontWeight: '800', fontSize: 11 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    width: '48%', backgroundColor: colors.background, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  statCardAccent: { backgroundColor: colors.primary, borderColor: colors.primary },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5, marginTop: 4 },
  statLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  sectionTitle: { marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: '700', color: colors.textMain },
  workbench: {
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 6,
  },
  segment: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  segmentBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { color: colors.textMuted, fontWeight: '800', fontSize: 12 },
  segmentTextActive: { color: colors.primaryFg },
  toolPanel: { gap: 10 },
  toolTitle: { color: colors.textMain, fontSize: 16, fontWeight: '900' },
  chipScroller: { gap: 8, paddingVertical: 2 },
  pickChip: {
    minHeight: 36,
    maxWidth: 180,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickChipText: { color: colors.textMuted, fontWeight: '800', fontSize: 12 },
  pickChipTextActive: { color: colors.primaryFg },
  formGrid: { flexDirection: 'row', gap: 8 },
  formField: { flex: 1, minWidth: 0 },
  formLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  formInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    color: colors.textMain,
    fontWeight: '700',
  },
  textArea: { minHeight: 78, paddingTop: 12, textAlignVertical: 'top' },
  fieldCaption: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  inlineActions: { flexDirection: 'row', gap: 8 },
  primaryBtn: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  primaryBtnText: { color: colors.primaryFg, fontWeight: '900' },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: colors.textMuted, fontWeight: '900' },
  listTitle: { color: colors.textMain, fontSize: 13, fontWeight: '900', marginTop: 6 },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  rowActions: { alignItems: 'flex-end', gap: 6 },
  iconAction: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconActionDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  iconActionText: { color: colors.primary, fontWeight: '900', fontSize: 11 },
  iconActionTextDanger: { color: colors.error },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  presetBtnActive: { backgroundColor: '#ECFDF5', borderColor: '#34D399' },
  presetText: { color: colors.textMuted, fontWeight: '800', fontSize: 11 },
  presetTextActive: { color: '#047857' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background,
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badge: { fontSize: 12, fontWeight: '700', color: colors.textMain, backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { color: colors.primaryFg, fontWeight: '700' },
  roleTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.secondary },
  roleTagAdmin: { backgroundColor: '#EFF6FF' },
  roleTagText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  roleTagTextAdmin: { color: colors.primary },
  roleBox: { alignItems: 'flex-end', gap: 6, maxWidth: 170 },
  roleActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' },
  roleActionBtn: { backgroundColor: colors.secondary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  roleActionText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '82%' },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.textMain },
  modalSub: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 18 },
  modalLabel: { color: colors.textMain, fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 14 },
  roleChoiceRow: { flexDirection: 'row', gap: 8 },
  roleChoice: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  roleChoiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChoiceText: { color: colors.textMuted, fontWeight: '800', fontSize: 12 },
  roleChoiceTextActive: { color: colors.primaryFg },
  storePicker: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden', maxHeight: 260 },
  storeChoice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  storeChoiceActive: { backgroundColor: '#EFF6FF' },
  storeChoiceText: { color: colors.textMain, fontSize: 14, fontWeight: '600', flex: 1 },
  storeChoiceTextActive: { color: colors.primary, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  roleMessage: { marginTop: 12, color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  modalCancelText: { color: colors.textMuted, fontWeight: '800' },
  modalSaveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  modalSaveBtnDisabled: { opacity: 0.65 },
  modalSaveText: { color: colors.primaryFg, fontWeight: '900' },
  empty: { padding: 18, alignItems: 'center', backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textMuted },
});
