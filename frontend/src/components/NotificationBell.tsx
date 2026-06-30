import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotifications } from '../notifications';
import { colors } from '../theme';

export default function NotificationBell({ size = 22 }: { size?: number }) {
  const router = useRouter();
  const { count } = useNotifications();
  return (
    <TouchableOpacity
      testID="notif-bell"
      onPress={() => router.push('/notifications')}
      style={styles.btn}
      hitSlop={10}
    >
      <Ionicons name="notifications-outline" size={size} color={colors.textMain} />
      {count > 0 && (
        <View style={styles.badge} testID="notif-badge">
          <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.background,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
