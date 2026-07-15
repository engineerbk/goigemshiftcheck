import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, Platform, ScrollView, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuth } from '../../src/auth';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';
import { api } from '../../src/api';

function roleLabel(role: string | undefined, t: (key: any) => string) {
  if (role === 'admin' || role === 'owner') return t('role_owner');
  if (role === 'manager') return t('role_manager');
  return t('role_employee');
}

export default function Profile() {
  const { user, signOut, refresh } = useAuth();
  const { lang, setLang, t } = useLang();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taskSaving, setTaskSaving] = useState<string | null>(null);
  const [proposalTask, setProposalTask] = useState<any>(null);
  const [proposalType, setProposalType] = useState<'cancel' | 'change'>('cancel');
  const [proposalReason, setProposalReason] = useState('');
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');

  const load = useCallback(async () => {
    setLoadingTasks(true);
    try {
      await refresh();
      const items = await api.myTasks();
      setTasks(items || []);
    } catch (e) {
      console.log('profile task load err', e);
    } finally {
      setLoadingTasks(false);
    }
  }, [refresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const completeTask = async (task: any) => {
    setTaskSaving(task.id);
    try {
      await api.completeTask(task.id);
      await load();
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setTaskSaving(null);
    }
  };

  const openProposal = (task: any, type: 'cancel' | 'change') => {
    setProposalTask(task);
    setProposalType(type);
    setProposalReason('');
    setProposalTitle(task.title || '');
    setProposalDescription(task.description || '');
  };

  const closeProposal = () => setProposalTask(null);

  const submitProposal = async () => {
    if (!proposalTask) return;
    if (!proposalReason.trim() && proposalType === 'cancel') {
      Alert.alert(t('failed'), 'Nhập lý do đề xuất');
      return;
    }
    setTaskSaving(proposalTask.id);
    try {
      await api.proposeTaskChange(proposalTask.id, {
        proposal_type: proposalType,
        reason: proposalReason,
        proposed_title: proposalType === 'change' ? proposalTitle : undefined,
        proposed_description: proposalType === 'change' ? proposalDescription : undefined,
      });
      closeProposal();
      Alert.alert(t('saved'), 'Đã gửi đề xuất cho cấp trên duyệt');
      await load();
    } catch (e: any) {
      Alert.alert(t('failed'), e.message);
    } finally {
      setTaskSaving(null);
    }
  };

  const doSignOut = () => {
    const run = async () => {
      await signOut();
      router.replace('/login');
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('sign_out')}\n\n${t('sign_out_confirm')}`)) run();
      return;
    }
    Alert.alert(t('sign_out'), t('sign_out_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('sign_out'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="profile-screen">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.brandRow}>
          <Image source={require('../../assets/images/logo.jpg')} style={styles.brandLogo} />
          <Text style={styles.brandText}>gói gém</Text>
        </View>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{roleLabel(user?.role, t).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.menu}>
          <View style={styles.menuItem}>
            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
            <Text style={styles.menuLabel}>{t('email')}</Text>
            <Text style={styles.menuValue} numberOfLines={1}>{user?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.menuItem}>
            <Ionicons name="shield-outline" size={20} color={colors.textMuted} />
            <Text style={styles.menuLabel}>{t('role')}</Text>
            <Text style={styles.menuValue}>{roleLabel(user?.role, t)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.menuItem, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="language-outline" size={20} color={colors.textMuted} />
              <Text style={styles.menuLabel}>{t('language')}</Text>
            </View>
            <View style={styles.langRow}>
              <TouchableOpacity
                testID="lang-en"
                onPress={() => setLang('en')}
                style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              >
                <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>English</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="lang-vi"
                onPress={() => setLang('vi')}
                style={[styles.langBtn, lang === 'vi' && styles.langBtnActive]}
              >
                <Text style={[styles.langText, lang === 'vi' && styles.langTextActive]}>Tiếng Việt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.taskCard} testID="my-tasks-section">
          <View style={styles.taskHeader}>
            <View>
              <Text style={styles.taskTitle}>Việc được giao</Text>
              <Text style={styles.taskSub}>
                {tasks.filter((task) => task.status !== 'completed').length} đang mở / {tasks.length} tổng
              </Text>
            </View>
            <Ionicons name="checkbox" size={22} color={colors.primary} />
          </View>

          {loadingTasks ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : tasks.length === 0 ? (
            <View style={styles.emptyTask}>
              <Text style={styles.emptyTaskText}>Chưa có task được giao</Text>
            </View>
          ) : (
            tasks.slice(0, 20).map((task) => (
              <View key={task.id} style={styles.taskRow} testID={`my-task-${task.id}`}>
                <View style={[styles.taskDot, { backgroundColor: task.status === 'completed' ? colors.success : colors.warning }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskName}>{task.title}</Text>
                  {task.description ? <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text> : null}
                  <Text style={styles.taskMeta}>
                    {task.store_location || '—'} • giao bởi {task.created_by_name || 'Quản lý'} • {task.status === 'completed' ? 'đã hoàn thành' : 'đang mở'}
                  </Text>
                </View>
                {task.status !== 'completed' ? (
                  <View style={styles.taskActions}>
                    <TouchableOpacity
                      style={styles.proposalBtn}
                      onPress={() => openProposal(task, 'change')}
                      disabled={taskSaving === task.id}
                      testID={`propose-task-${task.id}`}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelProposalBtn}
                      onPress={() => openProposal(task, 'cancel')}
                      disabled={taskSaving === task.id}
                      testID={`cancel-task-proposal-${task.id}`}
                    >
                      <Ionicons name="close" size={16} color={colors.error} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.completeBtn}
                      onPress={() => completeTask(task)}
                      disabled={taskSaving === task.id}
                      testID={`complete-task-${task.id}`}
                    >
                      {taskSaving === task.id ? (
                        <ActivityIndicator color={colors.primaryFg} size="small" />
                      ) : (
                        <Ionicons name="checkmark" size={18} color={colors.primaryFg} />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.doneBadge}>
                    <Ionicons name="checkmark-done" size={16} color={colors.success} />
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.signOut} onPress={doSignOut} testID="sign-out-btn">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>{t('sign_out')}</Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal visible={!!proposalTask} animationType="slide" transparent onRequestClose={closeProposal}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Đề xuất task</Text>
            <Text style={styles.modalSub}>{proposalTask?.title}</Text>
            <View style={styles.proposalTabs}>
              <TouchableOpacity style={[styles.proposalTab, proposalType === 'cancel' && styles.proposalTabActive]} onPress={() => setProposalType('cancel')}>
                <Text style={[styles.proposalTabText, proposalType === 'cancel' && styles.proposalTabTextActive]}>Huỷ task</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.proposalTab, proposalType === 'change' && styles.proposalTabActive]} onPress={() => setProposalType('change')}>
                <Text style={[styles.proposalTabText, proposalType === 'change' && styles.proposalTabTextActive]}>Thay đổi</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={proposalReason}
              onChangeText={setProposalReason}
              placeholder="Lý do đề xuất"
              placeholderTextColor={colors.textLight}
              multiline
            />
            {proposalType === 'change' ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  value={proposalTitle}
                  onChangeText={setProposalTitle}
                  placeholder="Tên task mới"
                  placeholderTextColor={colors.textLight}
                />
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  value={proposalDescription}
                  onChangeText={setProposalDescription}
                  placeholder="Mô tả/yêu cầu mới"
                  placeholderTextColor={colors.textLight}
                  multiline
                />
              </>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={closeProposal}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={submitProposal} disabled={!!taskSaving}>
                {taskSaving ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.modalSubmitText}>Gửi đề xuất</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20, paddingBottom: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  brandLogo: { width: 36, height: 36, borderRadius: 10 },
  brandText: { fontSize: 18, fontWeight: '800', color: colors.textMain, letterSpacing: -0.3 },
  headerCard: {
    backgroundColor: colors.background, borderRadius: 20, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: colors.primaryFg, fontSize: 32, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: colors.textMain, letterSpacing: -0.3 },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  roleBadge: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 999 },
  roleText: { fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 1 },
  menu: { backgroundColor: colors.background, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: colors.textMain, width: 60 },
  menuValue: { flex: 1, fontSize: 14, color: colors.textMuted, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.border },
  taskCard: { backgroundColor: colors.background, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 20 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  taskTitle: { color: colors.textMain, fontSize: 18, fontWeight: '900' },
  taskSub: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  taskRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 12 },
  taskDot: { width: 9, height: 9, borderRadius: 5 },
  taskName: { color: colors.textMain, fontSize: 14, fontWeight: '900' },
  taskDesc: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  taskMeta: { color: colors.textLight, fontSize: 11, fontWeight: '700', marginTop: 4 },
  taskActions: { alignItems: 'center', gap: 6 },
  completeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  proposalBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
  cancelProposalBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' },
  doneBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  emptyTask: { paddingVertical: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  emptyTaskText: { color: colors.textMuted, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  modalTitle: { color: colors.textMain, fontSize: 20, fontWeight: '900' },
  modalSub: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  proposalTabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  proposalTab: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  proposalTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  proposalTabText: { color: colors.textMuted, fontWeight: '900' },
  proposalTabTextActive: { color: colors.primaryFg },
  modalInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.textMain, paddingHorizontal: 12, paddingVertical: 10, fontWeight: '700', marginBottom: 10 },
  modalTextArea: { minHeight: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: colors.textMuted, fontWeight: '900' },
  modalSubmit: { flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { color: colors.primaryFg, fontWeight: '900' },
  langRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  langBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center',
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { color: colors.textMain, fontWeight: '600', fontSize: 14 },
  langTextActive: { color: colors.primaryFg, fontWeight: '700' },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 999, paddingVertical: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  signOutText: { color: colors.error, fontWeight: '700', fontSize: 16 },
});
