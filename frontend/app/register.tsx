import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth';
import { useLang } from '../src/i18n';
import { colors } from '../src/theme';

export default function Register() {
  const { signUp } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!name || !email || !password) { Alert.alert(t('missing_fields'), t('fill_all_fields')); return; }
    if (password.length < 6) { Alert.alert(t('weak_password'), t('min_6_chars')); return; }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert(t('registration_failed'), e.message || t('please_try_again'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
            <Ionicons name="chevron-back" size={24} color={colors.textMain} />
          </TouchableOpacity>

          <Image
            source={require('../assets/images/logo.jpg')}
            style={styles.logoImg}
            testID="brand-logo"
          />
          <Text style={styles.title}>{t('create_account')}</Text>
          <Text style={styles.sub}>{t('create_account_sub')}</Text>

          <Text style={styles.label}>{t('full_name')}</Text>
          <TextInput testID="register-name" style={styles.input} value={name} onChangeText={setName} placeholder="Jane Doe" placeholderTextColor={colors.textLight} />

          <Text style={styles.label}>{t('email')}</Text>
          <TextInput
            testID="register-email"
            style={styles.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            placeholder="you@company.com" placeholderTextColor={colors.textLight}
          />

          <Text style={styles.label}>{t('password')}</Text>
          <TextInput
            testID="register-password"
            style={styles.input} value={password} onChangeText={setPassword}
            secureTextEntry placeholder="min 6 characters" placeholderTextColor={colors.textLight}
          />

          <TouchableOpacity testID="register-submit" style={styles.primaryBtn} onPress={onSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.primaryBtnText}>{t('create_account')}</Text>}
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.muted}>{t('already_have_account')}</Text>
            <Link href="/login" asChild>
              <TouchableOpacity testID="go-to-login"><Text style={styles.link}>{t('sign_in')}</Text></TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 24 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 8 },
  logoImg: { width: 64, height: 64, borderRadius: 16, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.textMain, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.textMain,
  },
  primaryBtn: {
    marginTop: 28, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnText: { color: colors.primaryFg, fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 },
  muted: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '700' },
});
