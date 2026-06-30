import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useLang } from '../i18n';

type Status = 'pending' | 'approved' | 'rejected' | string | undefined | null;

const COMPACT = {
  approved: { bg: '#D1FAE5', fg: colors.success, icon: 'checkmark-circle' as const, key: 'shift_approved_label' },
  pending: { bg: '#FEF3C7', fg: colors.warning, icon: 'time' as const, key: 'pending_approval' },
  rejected: { bg: '#FEE2E2', fg: colors.error, icon: 'close-circle' as const, key: 'shift_rejected_label' },
};

export default function ApprovalBadge({ status, size = 'small' }: { status: Status; size?: 'small' | 'tiny' }) {
  const { t } = useLang();
  const norm: 'approved' | 'pending' | 'rejected' = (status === 'approved' || status === 'rejected') ? status : 'pending';
  const cfg = COMPACT[norm];
  const isTiny = size === 'tiny';
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, isTiny && styles.tiny]}>
      <Ionicons name={cfg.icon} size={isTiny ? 10 : 12} color={cfg.fg} />
      <Text style={[styles.text, { color: cfg.fg }, isTiny && styles.textTiny]}>{t(cfg.key)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start',
  },
  tiny: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontWeight: '700', fontSize: 11 },
  textTiny: { fontSize: 9 },
});
