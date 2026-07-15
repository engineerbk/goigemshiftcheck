import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { colors } from '../../src/theme';

function fmtDt(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function statusLabel(status?: string) {
  if (status === 'completed') return 'Hoàn thành';
  if (status === 'cancelled') return 'Đã huỷ';
  return 'Đang mở';
}

function statusColor(status?: string) {
  if (status === 'completed') return colors.success;
  if (status === 'cancelled') return colors.error;
  return colors.warning;
}

function proposalLabel(type?: string) {
  return type === 'cancel' ? 'Đề xuất huỷ task' : 'Đề xuất thay đổi task';
}

function proposalStatusLabel(status?: string) {
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'rejected') return 'Giữ nguyên';
  return 'Chờ duyệt';
}

function proposalStatusColor(status?: string) {
  if (status === 'approved') return colors.success;
  if (status === 'rejected') return colors.error;
  return colors.warning;
}

export default function TaskDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.taskDetail(id);
      setTask(data?.task || null);
      setProposals(data?.proposals || []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="task-detail-screen">
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Chi tiết nhiệm vụ</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !task ? (
          <View style={styles.emptyBox}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.textLight} />
            <Text style={styles.emptyText}>Không tìm thấy task hoặc bạn không có quyền xem.</Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.heroMeta}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(task.status) }]} />
                <Text style={styles.heroLabel}>{statusLabel(task.status).toUpperCase()}</Text>
              </View>
              <Text style={styles.title}>{task.title}</Text>
              {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
              <View style={styles.infoGrid}>
                <Info label="Cửa hàng" value={task.store_location || '—'} />
                <Info label="Người nhận" value={task.assigned_user_name || task.assigned_user_email || 'Task cửa hàng'} />
                <Info label="Giao bởi" value={task.created_by_name || '—'} />
                <Info label="Ngày giao" value={fmtDt(task.created_at)} />
              </View>
              {task.completed_by_name ? (
                <View style={styles.noticeGood}>
                  <Ionicons name="checkmark-done" size={17} color={colors.success} />
                  <Text style={styles.noticeGoodText}>
                    Hoàn thành bởi {task.completed_by_name} lúc {fmtDt(task.completed_at)}
                  </Text>
                </View>
              ) : null}
              {task.last_review_comment ? (
                <View style={styles.notice}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primary} />
                  <Text style={styles.noticeText}>{task.last_review_comment}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>Luồng đề xuất và bình luận</Text>
            {proposals.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Chưa có đề xuất thay đổi hoặc huỷ task.</Text>
              </View>
            ) : (
              proposals.map((proposal) => (
                <View key={proposal.id} style={styles.timelineItem} testID={`task-proposal-detail-${proposal.id}`}>
                  <View style={[styles.timelineDot, { backgroundColor: proposalStatusColor(proposal.status) }]} />
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineTitle}>{proposalLabel(proposal.proposal_type)}</Text>
                      <View style={[styles.proposalPill, { backgroundColor: proposalStatusColor(proposal.status) + '22' }]}>
                        <Text style={[styles.proposalPillText, { color: proposalStatusColor(proposal.status) }]}>
                          {proposalStatusLabel(proposal.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.timelineMeta}>
                      Bởi {proposal.requested_by_name || proposal.requested_by_email || '—'} • {fmtDt(proposal.created_at)}
                    </Text>
                    {proposal.reason ? <Comment label="Lý do đề xuất" value={proposal.reason} /> : null}
                    {proposal.proposed_title ? <ChangeLine label="Tên task đề xuất" value={proposal.proposed_title} /> : null}
                    {proposal.proposed_description ? <ChangeLine label="Mô tả đề xuất" value={proposal.proposed_description} /> : null}
                    {proposal.proposed_assigned_user_name || proposal.proposed_assigned_user_email ? (
                      <ChangeLine label="Người nhận đề xuất" value={proposal.proposed_assigned_user_name || proposal.proposed_assigned_user_email} />
                    ) : null}
                    {proposal.reviewed_at ? (
                      <>
                        <Text style={styles.timelineMeta}>
                          Xử lý bởi {proposal.reviewed_by_name || '—'} • {fmtDt(proposal.reviewed_at)}
                        </Text>
                        {proposal.review_comment ? <Comment label="Bình luận cấp trên" value={proposal.review_comment} highlighted /> : null}
                      </>
                    ) : (
                      <Text style={styles.pendingText}>Đang chờ cấp trên phê duyệt.</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ChangeLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.changeLine}>
      <Text style={styles.changeLabel}>{label}</Text>
      <Text style={styles.changeValue}>{value}</Text>
    </View>
  );
}

function Comment({ label, value, highlighted = false }: { label: string; value: string; highlighted?: boolean }) {
  return (
    <View style={[styles.commentBox, highlighted && styles.commentBoxHighlighted]}>
      <Text style={styles.commentLabel}>{label}</Text>
      <Text style={styles.commentText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 6 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', color: colors.textMain, fontSize: 17, fontWeight: '900' },
  container: { padding: 18, paddingBottom: 44 },
  hero: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  heroLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: colors.textMain, fontSize: 24, fontWeight: '900', lineHeight: 30 },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8, fontWeight: '600' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  infoBox: { width: '48%', minWidth: 145, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 11 },
  infoLabel: { color: colors.textLight, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  infoValue: { color: colors.textMain, fontSize: 13, fontWeight: '900', lineHeight: 17 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginTop: 12 },
  noticeText: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  noticeGood: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12, marginTop: 12 },
  noticeGoodText: { flex: 1, color: colors.success, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  sectionTitle: { color: colors.textMain, fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 12 },
  timelineItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 18 },
  timelineCard: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timelineTitle: { flex: 1, color: colors.textMain, fontSize: 15, fontWeight: '900' },
  timelineMeta: { color: colors.textLight, fontSize: 11, fontWeight: '800', marginTop: 5 },
  proposalPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  proposalPillText: { fontSize: 11, fontWeight: '900' },
  changeLine: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, marginTop: 9 },
  changeLabel: { color: colors.textLight, fontSize: 11, fontWeight: '800', marginBottom: 3 },
  changeValue: { color: colors.textMain, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  commentBox: { backgroundColor: colors.surface, borderRadius: 12, padding: 11, marginTop: 10, borderWidth: 1, borderColor: colors.border },
  commentBoxHighlighted: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  commentLabel: { color: colors.textLight, fontSize: 11, fontWeight: '900', marginBottom: 4 },
  commentText: { color: colors.textMain, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  pendingText: { color: colors.warning, fontSize: 12, fontWeight: '900', marginTop: 10 },
  emptyBox: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 18, alignItems: 'center', gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
