import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
import { useLang } from '../src/i18n';
import { colors } from '../src/theme';

export default function Login() {
  const { signIn } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) { Alert.alert(t('missing_fields'), t('enter_email_password')); return; }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert(t('login_failed'), e.message || t('please_try_again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image
              source={require('../assets/images/logo.jpg')}
              style={styles.logoImg}
              testID="brand-logo"
            />
            <Text style={styles.brandTitle}>{t('brand')}</Text>
            <Text style={styles.brandSub}>{t('sign_in_to_continue')}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              testID="login-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@company.com"
              placeholderTextColor={colors.textLight}
            />
            <Text style={styles.label}>{t('password')}</Text>
            <TextInput
              testID="login-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textLight}
            />

            <TouchableOpacity testID="login-submit" style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.primaryBtnText}>{t('sign_in')}</Text>}
            </TouchableOpacity>

            <View style={styles.row}>
              <Text style={styles.muted}>{t('no_account')}</Text>
              <Link href="/register" asChild>
                <TouchableOpacity testID="go-to-register"><Text style={styles.link}>{t('create_one')}</Text></TouchableOpacity>
              </Link>
            </View>

            <View style={styles.hint} testID="admin-hint">
              <Text style={styles.hintText}>{t('admin_demo')}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 32 },
  logoImg: {
    width: 96, height: 96, borderRadius: 22, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  brandTitle: { fontSize: 28, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  brandSub: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  form: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.textMain,
  },
  primaryBtn: {
    marginTop: 24, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  muted: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '700' },
  hint: { marginTop: 24, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  hintText: { color: '#1E40AF', fontSize: 12, textAlign: 'center' },
});
