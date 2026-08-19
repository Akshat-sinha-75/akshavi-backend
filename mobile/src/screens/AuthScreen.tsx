import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { api, API_BASE_URL, setCustomApiUrl } from '../services/api';
import { authStorage, StoredUser } from '../services/authStorage';
import { Shield } from 'lucide-react-native';

interface AuthScreenProps {
  onAuthSuccess: (user: StoredUser, token: string) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [currentStep, setCurrentStep] = useState<'AUTH' | 'PROFILE_SETUP'>('AUTH');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Authenticated Context
  const [tempUserId, setTempUserId] = useState<string>('');
  const [tempToken, setTempToken] = useState<string>('');

  // Step 1 Inputs
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [password, setPassword] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);

  // Step 2 Inputs
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('22');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [fakePin, setFakePin] = useState('9999');

  // Server Config
  const [serverUrl, setServerUrl] = useState(API_BASE_URL);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverStatus, setServerStatus] = useState<string | null>(null);

  const showAlert = (title: string, message: string) => {
    setFormError(message);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const checkServerConnection = async () => {
    try {
      setServerStatus('Connecting...');
      const res = await fetch(`${serverUrl}/health`);
      if (res.ok) {
        setServerStatus('🟢 Backend Connected');
        showAlert('Success', `Connected to backend at ${serverUrl}`);
      } else {
        setServerStatus('⚠️ Server error');
      }
    } catch (e: any) {
      setServerStatus('🔴 Unreachable');
      showAlert('Connection Failed', `Could not reach ${serverUrl}`);
    }
  };

  const handleSaveServerUrl = () => {
    setCustomApiUrl(serverUrl);
    setShowServerConfig(false);
    checkServerConnection();
  };

  const handleRequestOTP = async () => {
    setFormError(null);
    if (!loginIdentifier.trim()) {
      setFormError('Please enter your Email/Phone to get an OTP.');
      return;
    }
    setLoading(true);
    try {
      await api.requestOTP(loginIdentifier.trim());
      setOtpRequested(true);
      showAlert('OTP Sent', 'Check server logs for your simulated OTP.');
    } catch (e: any) {
      setFormError(e.message || 'Could not request OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setFormError(null);
    if (!loginIdentifier.trim()) {
      setFormError('Please enter your Email/Phone.');
      return;
    }
    if (!loginPassword.trim() && !loginOtp.trim()) {
      setFormError('Please enter your Password or OTP.');
      return;
    }

    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setLoading(true);
    try {
      const res = await api.login(loginIdentifier.trim(), loginPassword.trim() || undefined, loginOtp.trim() || undefined);
      if (res && res.user) {
        if (!res.user.profileCompleted) {
          setTempUserId(res.user.id);
          setTempToken(res.token);
          setCurrentStep('PROFILE_SETUP');
        } else {
          await authStorage.saveAuth(res.token, res.user);
          onAuthSuccess(res.user, res.token);
        }
      }
    } catch (e: any) {
      setFormError(e.message || 'Invalid credentials or OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setFormError(null);
    if (!email.trim() || !phoneNumber.trim() || !password.trim()) {
      setFormError('Please fill in Email, Phone Number, and Password.');
      return;
    }

    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setLoading(true);
    try {
      const res = await api.register(email.trim().toLowerCase(), phoneNumber.trim(), password.trim());
      if (res && res.user) {
        setTempUserId(res.user.id);
        setTempToken(res.token);
        setCurrentStep('PROFILE_SETUP');
      }
    } catch (e: any) {
      setFormError(e.message || 'Could not register account.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    setFormError(null);
    if (!fullName.trim() || pin.length !== 4 || fakePin.length !== 4) {
      setFormError('Please fill in Name, 4-digit Real PIN, and 4-digit Fake PIN.');
      return;
    }

    if (pin === fakePin) {
      setFormError('Real PIN and Fake PIN must be different!');
      return;
    }

    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    setLoading(true);
    try {
      const ageNum = parseInt(age, 10) || 22;
      const updatedUser = await api.completeProfile(
        tempUserId,
        fullName.trim(),
        ageNum,
        address.trim() || 'Mumbai, Maharashtra',
        pin.trim(),
        fakePin.trim()
      );

      showAlert('🎉 Profile Activated', `Your Unique Safety Code is: ${updatedUser.userCode}`);
      await authStorage.saveAuth(tempToken, updatedUser);
      onAuthSuccess(updatedUser, tempToken);
    } catch (e: any) {
      setFormError(e.message || 'Failed to complete profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Top Minimalist Header */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.greetingTitle}>Welcome to Akshavi</Text>
            <Text style={styles.greetingSubtitle}>
              {currentStep === 'PROFILE_SETUP' ? 'Step 2: Profile & Safety Setup' : 'Personal Security & Emergency Network'}
            </Text>
          </View>
          <View style={styles.avatarCircle}>
            <Shield color="#212529" size={24} />
          </View>
        </View>

        {/* Server Config Ribbon */}
        <TouchableOpacity
          style={styles.serverPill}
          activeOpacity={0.8}
          onPress={() => setShowServerConfig(!showServerConfig)}
        >
          <Text style={styles.serverPillText} numberOfLines={1}>
            Gateway: <Text style={{ fontWeight: '700', color: '#111827' }}>{serverUrl}</Text>
          </Text>
          <Text style={styles.configLink}>{showServerConfig ? 'Close' : 'Edit'}</Text>
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.configCard}>
            <Text style={styles.inputLabel}>BACKEND ENDPOINT URL</Text>
            <TextInput
              style={styles.cleanInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://localhost:8080"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={checkServerConnection}>
                <Text style={styles.secondaryBtnText}>Test Server</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryPillSmall} onPress={handleSaveServerUrl}>
                <Text style={styles.primaryPillSmallText}>Save</Text>
              </TouchableOpacity>
            </View>
            {serverStatus && (
              <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>{serverStatus}</Text>
            )}
          </View>
        )}

        {/* Inline Form Error Notification */}
        {formError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {formError}</Text>
          </View>
        )}

        {/* STEP 1: AUTHENTICATION (Sign In / Sign Up) */}
        {currentStep === 'AUTH' && (
          <View>
            {/* Pill Tab Switcher */}
            <View style={styles.pillTabContainer}>
              <TouchableOpacity
                style={[styles.pillTab, !isRegistering && styles.pillTabActive]}
                onPress={() => { setIsRegistering(false); setFormError(null); }}
              >
                <Text style={[styles.pillTabText, !isRegistering && styles.pillTabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillTab, isRegistering && styles.pillTabActive]}
                onPress={() => { setIsRegistering(true); setFormError(null); }}
              >
                <Text style={[styles.pillTabText, isRegistering && styles.pillTabTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Clean White Card */}
            <View style={styles.whiteCard}>
              {isRegistering ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                    <TextInput
                      style={styles.cleanInput}
                      placeholder="priya@example.com"
                      placeholderTextColor="#9ca3af"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>PHONE NUMBER (+91)</Text>
                    <TextInput
                      style={styles.cleanInput}
                      placeholder="+91 98765 43210"
                      placeholderTextColor="#9ca3af"
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CREATE PASSWORD</Text>
                    <TextInput
                      style={styles.cleanInput}
                      placeholder="••••••••••••"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>EMAIL OR PHONE NUMBER</Text>
                    <TextInput
                      style={styles.cleanInput}
                      placeholder="priya@womensafety.in or +91..."
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="none"
                      value={loginIdentifier}
                      onChangeText={setLoginIdentifier}
                    />
                  </View>

                  {!otpRequested ? (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>PASSWORD (Optional if using OTP)</Text>
                      <TextInput
                        style={styles.cleanInput}
                        placeholder="••••••••••••"
                        placeholderTextColor="#9ca3af"
                        secureTextEntry
                        value={loginPassword}
                        onChangeText={setLoginPassword}
                      />
                      <TouchableOpacity style={{ marginTop: 8 }} onPress={handleRequestOTP}>
                        <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600' }}>Get Login OTP instead?</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>ENTER 6-DIGIT OTP</Text>
                      <TextInput
                        style={styles.pinInputClean}
                        placeholder="------"
                        placeholderTextColor="#9ca3af"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={loginOtp}
                        onChangeText={setLoginOtp}
                      />
                      <TouchableOpacity style={{ marginTop: 8 }} onPress={handleRequestOTP}>
                        <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600' }}>Resend OTP</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* Pitch Black Action Pill Button */}
              <TouchableOpacity
                style={styles.blackActionPill}
                activeOpacity={0.85}
                onPress={isRegistering ? handleRegister : handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.blackActionPillText}>
                      {isRegistering ? 'Next: Build Profile' : 'Sign In'}
                    </Text>
                    <View style={styles.arrowCircle}>
                      <Text style={{ fontSize: 13, color: '#111827', fontWeight: '900' }}>→</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 2: PROFILE BUILDING */}
        {currentStep === 'PROFILE_SETUP' && (
          <View style={styles.whiteCard}>
            <View style={{ marginBottom: 4 }}>
              <Text style={styles.stepBadge}>STEP 02</Text>
              <Text style={styles.cardHeaderTitle}>Build Your Profile</Text>
              <Text style={styles.cardHeaderSub}>
                Setup your security PINs and generate your Unique Safety Code.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>LEGAL FULL NAME</Text>
              <TextInput
                style={styles.cleanInput}
                placeholder="e.g. Priya Sharma"
                placeholderTextColor="#9ca3af"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>AGE</Text>
                <TextInput
                  style={styles.cleanInput}
                  placeholder="23"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  value={age}
                  onChangeText={setAge}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={styles.inputLabel}>CITY / AREA</Text>
                <TextInput
                  style={styles.cleanInput}
                  placeholder="Mumbai, MH"
                  placeholderTextColor="#9ca3af"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>REAL 4-DIGIT PIN (Safe Deactivation)</Text>
              <TextInput
                style={styles.pinInputClean}
                placeholder="••••"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                value={pin}
                onChangeText={setPin}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inputLabel}>FAKE PIN (Silent Duress Alarm)</Text>
                <Text style={styles.duressTag}>SILENT ALERT</Text>
              </View>
              <Text style={styles.helperText}>
                Entering this PIN unlocks the app normally but secretly broadcasts an emergency alert to all guardians.
              </Text>
              <TextInput
                style={[styles.pinInputClean, { borderColor: '#fca5a5', backgroundColor: '#fff5f5' }]}
                placeholder="9999"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                value={fakePin}
                onChangeText={setFakePin}
              />
            </View>

            <TouchableOpacity
              style={styles.blackActionPill}
              activeOpacity={0.85}
              onPress={handleCompleteProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.blackActionPillText}>Complete Profile & Get Code</Text>
                  <View style={styles.arrowCircle}>
                    <Text style={{ fontSize: 13, color: '#111827', fontWeight: '900' }}>→</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f7', // Using requested background color
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 16,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 10,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#212529', // Using requested dark color
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  serverPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } as any : {}),
  },
  serverPillText: {
    fontSize: 12,
    color: '#6b7280',
  },
  configLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#212529',
  },
  configCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    gap: 8,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } as any : {}),
  },
  errorBanner: {
    backgroundColor: 'rgba(254, 226, 226, 0.9)',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } as any : {}),
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  pillTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(229, 231, 235, 0.6)',
    borderRadius: 25,
    padding: 4,
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } as any : {}),
  },
  pillTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: 'center',
  },
  pillTabActive: {
    backgroundColor: '#212529',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  pillTabTextActive: {
    color: '#ffffff',
  },
  whiteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    gap: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } as any : {}),
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cleanInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#212529',
    fontWeight: '500',
  },
  pinInputClean: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    color: '#212529',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 10,
  },
  blackActionPill: {
    backgroundColor: '#212529',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#212529',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  blackActionPillText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#212529',
    letterSpacing: 0.5,
  },
  cardHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#212529',
    marginTop: 2,
  },
  cardHeaderSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 18,
  },
  duressTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ef4444',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 16,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  secondaryBtnText: {
    color: '#212529',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryPillSmall: {
    backgroundColor: '#212529',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  primaryPillSmallText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
