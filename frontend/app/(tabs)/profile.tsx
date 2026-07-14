import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { useLang } from '../../src/i18n';
import { colors } from '../../src/theme';

export default function Profile() {
  const { user, signOut } = useAuth();
  const { lang, setLang, t } = useLang();
  const router = useRouter();

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
      <View style={styles.container}>
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
            <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
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
            <Text style={styles.menuValue}>{user?.role}</Text>
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

        <TouchableOpacity style={styles.signOut} onPress={doSignOut} testID="sign-out-btn">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>{t('sign_out')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20 },
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
