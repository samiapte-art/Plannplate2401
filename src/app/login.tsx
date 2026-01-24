import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, X, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const sendPasswordResetOTP = useAuthStore((s) => s.sendPasswordResetOTP);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // If user is already logged in, redirect to home
  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Button animation
  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    buttonScale.value = withSpring(0.96);
  }, []);

  const handlePressOut = useCallback(() => {
    buttonScale.value = withSpring(1);
  }, []);

  const handleLogin = useCallback(async () => {
    setError('');
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error || 'Login failed');
    }

    setIsLoading(false);
  }, [email, password, login, router]);

  const navigateToSignup = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/signup');
  }, [router]);

  const openForgotModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResetEmail(email); // Pre-fill with current email if any
    setResetError('');
    setResetSuccess(false);
    setShowForgotModal(true);
  }, [email]);

  const closeForgotModal = useCallback(() => {
    setShowForgotModal(false);
    setResetEmail('');
    setResetError('');
    setResetSuccess(false);
  }, []);

  const handleForgotPassword = useCallback(async () => {
    setResetError('');
    setIsResetting(true);

    const result = await sendPasswordResetOTP(resetEmail);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResetSuccess(true);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResetError(result.error || 'Failed to send OTP');
    }

    setIsResetting(false);
  }, [resetEmail, sendPasswordResetOTP]);

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#f8f6f0', '#e8e4d9', '#d4cfc2']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 px-6 justify-center">
            {/* Logo & Header */}
            <Animated.View
              entering={FadeIn.delay(100).duration(600)}
              className="items-center mb-10"
            >
              <Image
                source={require('../../public/untitled-design---2026-01-09t100756.png')}
                style={{ width: 100, height: 100, marginBottom: 16 }}
                resizeMode="contain"
              />
              <Text className="text-3xl font-bold text-[#2d3a2d] tracking-tight">
                Welcome Back
              </Text>
              <Text className="text-base text-[#5a6b5a] mt-2">
                Sign in to continue meal planning
              </Text>
            </Animated.View>

            {/* Error Message */}
            {error ? (
              <Animated.View
                entering={FadeInDown.duration(300)}
                className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4"
              >
                <Text className="text-red-600 text-center text-sm">{error}</Text>
              </Animated.View>
            ) : null}

            {/* Form */}
            <Animated.View entering={FadeInDown.delay(200).duration(600)}>
              {/* Email Input */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-[#4a5a4a] mb-2 ml-1">
                  Email
                </Text>
                <View className="flex-row items-center bg-white/80 rounded-2xl px-4 py-3.5 border border-[#d4cfc2]">
                  <Mail size={20} color="#6a7d56" strokeWidth={1.5} />
                  <TextInput
                    className="flex-1 ml-3 text-base text-[#2d3a2d]"
                    placeholder="your@email.com"
                    placeholderTextColor="#9ca39c"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="mb-3">
                <Text className="text-sm font-medium text-[#4a5a4a] mb-2 ml-1">
                  Password
                </Text>
                <View className="flex-row items-center bg-white/80 rounded-2xl px-4 py-3.5 border border-[#d4cfc2]">
                  <Lock size={20} color="#6a7d56" strokeWidth={1.5} />
                  <TextInput
                    className="flex-1 ml-3 text-base text-[#2d3a2d]"
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca39c"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={10}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#6a7d56" strokeWidth={1.5} />
                    ) : (
                      <Eye size={20} color="#6a7d56" strokeWidth={1.5} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Forgot Password Link */}
              <View className="items-end mb-6">
                <Pressable onPress={openForgotModal} hitSlop={10}>
                  <Text className="text-[#6a7d56] text-sm font-medium">
                    Forgot Password?
                  </Text>
                </Pressable>
              </View>

              {/* Login Button */}
              <Animated.View style={buttonAnimatedStyle}>
                <Pressable
                  onPress={handleLogin}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={isLoading}
                  className="overflow-hidden rounded-2xl"
                >
                  <LinearGradient
                    colors={['#7a8d66', '#6a7d56', '#5a6d46']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 16,
                    }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white text-base font-semibold">
                        Sign In
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </Animated.View>

            {/* Sign Up Link */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(600)}
              className="flex-row justify-center mt-8"
            >
              <Text className="text-[#5a6b5a]">Don't have an account? </Text>
              <Pressable onPress={navigateToSignup}>
                <Text className="text-[#6a7d56] font-semibold">Sign Up</Text>
              </Pressable>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={closeForgotModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-[#f8f6f0] rounded-3xl w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="text-lg font-bold text-[#2d3a2d]">
                Reset Password
              </Text>
              <Pressable
                onPress={closeForgotModal}
                hitSlop={10}
                className="p-1"
              >
                <X size={22} color="#6a7d56" strokeWidth={2} />
              </Pressable>
            </View>

            <View className="px-5 pb-6">
              {resetSuccess ? (
                // Success State
                <View className="items-center py-4">
                  <View className="bg-[#6a7d56]/10 rounded-full p-4 mb-4">
                    <CheckCircle size={40} color="#6a7d56" strokeWidth={1.5} />
                  </View>
                  <Text className="text-base font-semibold text-[#2d3a2d] text-center mb-2">
                    Check your email
                  </Text>
                  <Text className="text-sm text-[#5a6b5a] text-center mb-5">
                    We've sent an 8-digit OTP to{'\n'}
                    <Text className="font-medium text-[#2d3a2d]">{resetEmail}</Text>
                  </Text>
                  <Pressable
                    onPress={() => {
                      closeForgotModal();
                      router.push({
                        pathname: '/verify-otp',
                        params: { email: resetEmail },
                      });
                    }}
                    className="bg-[#6a7d56] rounded-xl py-3 px-8"
                  >
                    <Text className="text-white font-semibold">Enter OTP</Text>
                  </Pressable>
                </View>
              ) : (
                // Input State
                <>
                  <Text className="text-sm text-[#5a6b5a] mb-4">
                    Enter your email address and we'll send you an 8-digit OTP to reset your password.
                  </Text>

                  {/* Reset Error */}
                  {resetError ? (
                    <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                      <Text className="text-red-600 text-center text-sm">{resetError}</Text>
                    </View>
                  ) : null}

                  {/* Email Input */}
                  <View className="flex-row items-center bg-white rounded-xl px-4 py-3 border border-[#d4cfc2] mb-4">
                    <Mail size={20} color="#6a7d56" strokeWidth={1.5} />
                    <TextInput
                      className="flex-1 ml-3 text-base text-[#2d3a2d]"
                      placeholder="your@email.com"
                      placeholderTextColor="#9ca39c"
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isResetting}
                      autoFocus
                    />
                  </View>

                  {/* Send Button */}
                  <Pressable
                    onPress={handleForgotPassword}
                    disabled={isResetting || !resetEmail.trim()}
                    className="overflow-hidden rounded-xl"
                  >
                    <LinearGradient
                      colors={
                        isResetting || !resetEmail.trim()
                          ? ['#9ca39c', '#8a918a', '#787f78']
                          : ['#7a8d66', '#6a7d56', '#5a6d46']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        paddingVertical: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 12,
                      }}
                    >
                      {isResetting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white text-base font-semibold">
                          Send OTP
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
