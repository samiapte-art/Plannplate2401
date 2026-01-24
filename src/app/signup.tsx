import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, User, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useAuthStore } from '@/lib/auth-store';

export default function SignupScreen() {
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // If user is already logged in, redirect to home
  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSignup = useCallback(async () => {
    setError('');

    // Validate confirm password
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);

    const result = await signUp(email, password, name);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg = result.error || 'Sign up failed';
      setError(errorMsg);

      // If error is about duplicate email, add a prompt to go to login
      if (errorMsg.toLowerCase().includes('already registered') || errorMsg.toLowerCase().includes('already exists')) {
        // Auto-redirect to login after a brief delay to show the error
        const timer = setTimeout(() => {
          router.replace('/login');
        }, 2000);
        return () => clearTimeout(timer);
      }
    }

    setIsLoading(false);
  }, [email, password, confirmPassword, name, signUp, router]);

  const navigateToLogin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

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
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back Button */}
            <Animated.View entering={FadeIn.delay(100).duration(400)} className="mt-2">
              <Pressable
                onPress={navigateToLogin}
                className="flex-row items-center py-2"
                hitSlop={10}
              >
                <ArrowLeft size={20} color="#6a7d56" strokeWidth={2} />
                <Text className="text-[#6a7d56] font-medium ml-1">Back</Text>
              </Pressable>
            </Animated.View>

            {/* Logo & Header */}
            <Animated.View
              entering={FadeIn.delay(100).duration(600)}
              className="items-center mt-6 mb-8"
            >
              <Image
                source={require('../../public/untitled-design---2026-01-09t100756.png')}
                style={{ width: 80, height: 80, marginBottom: 12 }}
                resizeMode="contain"
              />
              <Text className="text-2xl font-bold text-[#2d3a2d] tracking-tight">
                Create Account
              </Text>
              <Text className="text-sm text-[#5a6b5a] mt-1">
                Start your meal planning journey
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
              {/* Name Input */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-[#4a5a4a] mb-2 ml-1">
                  Full Name
                </Text>
                <View className="flex-row items-center bg-white/80 rounded-2xl px-4 py-3.5 border border-[#d4cfc2]">
                  <User size={20} color="#6a7d56" strokeWidth={1.5} />
                  <TextInput
                    className="flex-1 ml-3 text-base text-[#2d3a2d]"
                    placeholder="John Doe"
                    placeholderTextColor="#9ca39c"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                </View>
              </View>

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
              <View className="mb-4">
                <Text className="text-sm font-medium text-[#4a5a4a] mb-2 ml-1">
                  Password
                </Text>
                <View className="flex-row items-center bg-white/80 rounded-2xl px-4 py-3.5 border border-[#d4cfc2]">
                  <Lock size={20} color="#6a7d56" strokeWidth={1.5} />
                  <TextInput
                    className="flex-1 ml-3 text-base text-[#2d3a2d]"
                    placeholder="At least 6 characters"
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

              {/* Confirm Password Input */}
              <View className="mb-6">
                <Text className="text-sm font-medium text-[#4a5a4a] mb-2 ml-1">
                  Confirm Password
                </Text>
                <View className="flex-row items-center bg-white/80 rounded-2xl px-4 py-3.5 border border-[#d4cfc2]">
                  <Lock size={20} color="#6a7d56" strokeWidth={1.5} />
                  <TextInput
                    className="flex-1 ml-3 text-base text-[#2d3a2d]"
                    placeholder="Re-enter password"
                    placeholderTextColor="#9ca39c"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={10}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color="#6a7d56" strokeWidth={1.5} />
                    ) : (
                      <Eye size={20} color="#6a7d56" strokeWidth={1.5} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Sign Up Button */}
              <Animated.View style={buttonAnimatedStyle}>
                <Pressable
                  onPress={handleSignup}
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
                        Create Account
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </Animated.View>

            {/* Login Link */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(600)}
              className="flex-row justify-center mt-6 mb-8"
            >
              <Text className="text-[#5a6b5a]">Already have an account? </Text>
              <Pressable onPress={navigateToLogin}>
                <Text className="text-[#6a7d56] font-semibold">Sign In</Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
