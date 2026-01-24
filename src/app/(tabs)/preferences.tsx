import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  User,
  UtensilsCrossed,
  AlertTriangle,
  Clock,
  ChefHat,
  Users,
  ChevronRight,
  Check,
  LogOut,
  Mail,
  Pause,
  Play,
  Trash2
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMealPlanStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { useSubscriptionStore, useAccountStatus } from '@/lib/subscription-store';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { AccountManagementModal } from '@/components/AccountManagementModal';

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Paleo',
  'Low-Carb',
  'Low-Sodium',
  'Halal',
  'Kosher',
];

const CUISINE_OPTIONS = [
  'Italian',
  'Mexican',
  'Asian',
  'Mediterranean',
  'Indian',
  'American',
  'French',
  'Japanese',
  'Thai',
  'Greek',
];

const ALLERGY_OPTIONS = [
  'Peanuts',
  'Tree Nuts',
  'Milk',
  'Eggs',
  'Wheat',
  'Soy',
  'Fish',
  'Shellfish',
  'Sesame',
];

const SKILL_LEVELS = [
  { key: 'beginner', label: 'Beginner', description: 'Simple recipes, basic techniques' },
  { key: 'intermediate', label: 'Intermediate', description: 'More variety, some advanced techniques' },
  { key: 'advanced', label: 'Advanced', description: 'Complex recipes, diverse cuisines' },
] as const;

const PREP_TIME_OPTIONS = [
  { key: 'quick', label: 'Quick', description: 'Under 30 minutes' },
  { key: 'moderate', label: 'Moderate', description: '30-60 minutes' },
  { key: 'elaborate', label: 'Elaborate', description: 'No time limit' },
] as const;

interface MultiSelectSectionProps {
  title: string;
  subtitle: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  isDark: boolean;
  icon: React.ReactNode;
}

function MultiSelectSection({ title, subtitle, options, selected, onToggle, isDark, icon }: MultiSelectSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className={cn(
      "rounded-2xl overflow-hidden mb-4",
      isDark ? "bg-charcoal-800/50" : "bg-white"
    )}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded(!expanded);
        }}
        className="flex-row items-center p-4"
      >
        <View className={cn(
          "w-10 h-10 rounded-xl items-center justify-center mr-3",
          isDark ? "bg-charcoal-700" : "bg-cream-100"
        )}>
          {icon}
        </View>
        <View className="flex-1">
          <Text className={cn(
            "text-base font-semibold",
            isDark ? "text-white" : "text-charcoal-900"
          )}>
            {title}
          </Text>
          <Text className={cn(
            "text-sm",
            isDark ? "text-charcoal-400" : "text-charcoal-500"
          )}>
            {selected.length > 0 ? `${selected.length} selected` : subtitle}
          </Text>
        </View>
        <ChevronRight
          size={20}
          color={isDark ? '#888888' : '#6d6d6d'}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4">
          <View className="flex-row flex-wrap">
            {options.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onToggle(option);
                  }}
                  className={cn(
                    "flex-row items-center px-3 py-2 rounded-full mr-2 mb-2",
                    isSelected
                      ? isDark ? "bg-sage-600" : "bg-sage-500"
                      : isDark ? "bg-charcoal-700" : "bg-cream-100"
                  )}
                >
                  {isSelected && (
                    <Check size={14} color="#fff" className="mr-1" />
                  )}
                  <Text className={cn(
                    "text-sm font-medium",
                    isSelected
                      ? "text-white"
                      : isDark ? "text-charcoal-300" : "text-charcoal-600"
                  )}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

export default function PreferencesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const preferences = useMealPlanStore((s) => s.preferences);
  const setPreferences = useMealPlanStore((s) => s.setPreferences);
  const clearAllData = useMealPlanStore((s) => s.clearAllData);

  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const accountStatus = useAccountStatus();
  const pauseAccount = useSubscriptionStore((s) => s.pauseAccount);
  const resumeAccount = useSubscriptionStore((s) => s.resumeAccount);
  const deleteAccount = useSubscriptionStore((s) => s.deleteAccount);

  const [modalType, setModalType] = useState<'pause' | 'resume' | 'delete' | null>(null);
  const isPaused = accountStatus === 'paused';

  const handleLogout = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const handleAccountAction = useCallback(async () => {
    if (!currentUser?.id) return;

    let success = false;

    switch (modalType) {
      case 'pause':
        success = await pauseAccount(currentUser.id);
        break;
      case 'resume':
        success = await resumeAccount(currentUser.id);
        break;
      case 'delete':
        success = await deleteAccount(currentUser.id);
        if (success) {
          clearAllData();
          await logout();
          router.replace('/login');
        }
        break;
    }

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalType(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [currentUser?.id, modalType, pauseAccount, resumeAccount, deleteAccount, clearAllData, logout, router]);

  const toggleDietaryRestriction = useCallback((restriction: string) => {
    const current = preferences.dietaryRestrictions;
    const updated = current.includes(restriction)
      ? current.filter((r) => r !== restriction)
      : [...current, restriction];
    setPreferences({ dietaryRestrictions: updated });
  }, [preferences.dietaryRestrictions, setPreferences]);

  const toggleCuisinePreference = useCallback((cuisine: string) => {
    const current = preferences.cuisinePreferences;
    const updated = current.includes(cuisine)
      ? current.filter((c) => c !== cuisine)
      : [...current, cuisine];
    setPreferences({ cuisinePreferences: updated });
  }, [preferences.cuisinePreferences, setPreferences]);

  const toggleAllergy = useCallback((allergy: string) => {
    const current = preferences.allergies;
    const updated = current.includes(allergy)
      ? current.filter((a) => a !== allergy)
      : [...current, allergy];
    setPreferences({ allergies: updated });
  }, [preferences.allergies, setPreferences]);

  return (
    <View className={cn("flex-1", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
      <LinearGradient
        colors={isDark ? ['#2f3628', '#262626'] : ['#e3e7dd', '#fefdfb']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            className="px-5 pt-4 pb-6"
          >
            <Text className={cn(
              "text-sm font-medium uppercase tracking-wider",
              isDark ? "text-sage-400" : "text-sage-600"
            )}>
              Personalize
            </Text>
            <Text className={cn(
              "text-3xl font-bold mt-1",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              Preferences
            </Text>
            <Text className={cn(
              "text-base mt-2",
              isDark ? "text-charcoal-400" : "text-charcoal-500"
            )}>
              Customize your meal planning experience
            </Text>
          </Animated.View>

          {/* Preferences Sections */}
          <View className="px-5">
            {/* Serving Size */}
            <Animated.View
              entering={FadeInDown.delay(150).springify()}
              className={cn(
                "rounded-2xl p-4 mb-4",
                isDark ? "bg-charcoal-800/50" : "bg-white"
              )}
            >
              <View className="flex-row items-center mb-4">
                <View className={cn(
                  "w-10 h-10 rounded-xl items-center justify-center mr-3",
                  isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}>
                  <Users size={20} color={isDark ? '#a6b594' : '#6a7d56'} />
                </View>
                <View className="flex-1">
                  <Text className={cn(
                    "text-base font-semibold",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    Serving Size
                  </Text>
                  <Text className={cn(
                    "text-sm",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    Default portions per recipe
                  </Text>
                </View>
              </View>
              <View className="flex-row">
                {[1, 2, 4, 6].map((size) => (
                  <Pressable
                    key={size}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPreferences({ servingSize: size });
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-xl mr-2 items-center",
                      preferences.servingSize === size
                        ? isDark ? "bg-sage-600" : "bg-sage-500"
                        : isDark ? "bg-charcoal-700" : "bg-cream-100"
                    )}
                  >
                    <Text className={cn(
                      "text-base font-semibold",
                      preferences.servingSize === size
                        ? "text-white"
                        : isDark ? "text-charcoal-300" : "text-charcoal-600"
                    )}>
                      {size}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* Cooking Skill Level */}
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              className={cn(
                "rounded-2xl p-4 mb-4",
                isDark ? "bg-charcoal-800/50" : "bg-white"
              )}
            >
              <View className="flex-row items-center mb-4">
                <View className={cn(
                  "w-10 h-10 rounded-xl items-center justify-center mr-3",
                  isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}>
                  <ChefHat size={20} color={isDark ? '#a6b594' : '#6a7d56'} />
                </View>
                <View className="flex-1">
                  <Text className={cn(
                    "text-base font-semibold",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    Cooking Skill
                  </Text>
                  <Text className={cn(
                    "text-sm",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    Match recipes to your experience
                  </Text>
                </View>
              </View>
              {SKILL_LEVELS.map((skill) => (
                <Pressable
                  key={skill.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreferences({ cookingSkillLevel: skill.key });
                  }}
                  className={cn(
                    "flex-row items-center p-3 rounded-xl mb-2",
                    preferences.cookingSkillLevel === skill.key
                      ? isDark ? "bg-sage-800/50 border border-sage-600" : "bg-sage-50 border border-sage-300"
                      : isDark ? "bg-charcoal-700" : "bg-cream-100"
                  )}
                >
                  <View className={cn(
                    "w-5 h-5 rounded-full border-2 items-center justify-center mr-3",
                    preferences.cookingSkillLevel === skill.key
                      ? "border-sage-500 bg-sage-500"
                      : isDark ? "border-charcoal-500" : "border-charcoal-300"
                  )}>
                    {preferences.cookingSkillLevel === skill.key && (
                      <Check size={12} color="#fff" strokeWidth={3} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className={cn(
                      "text-base font-medium",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {skill.label}
                    </Text>
                    <Text className={cn(
                      "text-sm",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      {skill.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Animated.View>

            {/* Meal Prep Time */}
            <Animated.View
              entering={FadeInDown.delay(250).springify()}
              className={cn(
                "rounded-2xl p-4 mb-4",
                isDark ? "bg-charcoal-800/50" : "bg-white"
              )}
            >
              <View className="flex-row items-center mb-4">
                <View className={cn(
                  "w-10 h-10 rounded-xl items-center justify-center mr-3",
                  isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}>
                  <Clock size={20} color={isDark ? '#a6b594' : '#6a7d56'} />
                </View>
                <View className="flex-1">
                  <Text className={cn(
                    "text-base font-semibold",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    Prep Time Preference
                  </Text>
                  <Text className={cn(
                    "text-sm",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    How much time do you have?
                  </Text>
                </View>
              </View>
              {PREP_TIME_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreferences({ mealPrepTime: option.key });
                  }}
                  className={cn(
                    "flex-row items-center p-3 rounded-xl mb-2",
                    preferences.mealPrepTime === option.key
                      ? isDark ? "bg-sage-800/50 border border-sage-600" : "bg-sage-50 border border-sage-300"
                      : isDark ? "bg-charcoal-700" : "bg-cream-100"
                  )}
                >
                  <View className={cn(
                    "w-5 h-5 rounded-full border-2 items-center justify-center mr-3",
                    preferences.mealPrepTime === option.key
                      ? "border-sage-500 bg-sage-500"
                      : isDark ? "border-charcoal-500" : "border-charcoal-300"
                  )}>
                    {preferences.mealPrepTime === option.key && (
                      <Check size={12} color="#fff" strokeWidth={3} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className={cn(
                      "text-base font-medium",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {option.label}
                    </Text>
                    <Text className={cn(
                      "text-sm",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Animated.View>

            {/* Dietary Restrictions */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <MultiSelectSection
                title="Dietary Restrictions"
                subtitle="Select any that apply"
                options={DIETARY_OPTIONS}
                selected={preferences.dietaryRestrictions}
                onToggle={toggleDietaryRestriction}
                isDark={isDark}
                icon={<UtensilsCrossed size={20} color={isDark ? '#a6b594' : '#6a7d56'} />}
              />
            </Animated.View>

            {/* Cuisine Preferences */}
            <Animated.View entering={FadeInDown.delay(350).springify()}>
              <MultiSelectSection
                title="Cuisine Preferences"
                subtitle="Select your favorites"
                options={CUISINE_OPTIONS}
                selected={preferences.cuisinePreferences}
                onToggle={toggleCuisinePreference}
                isDark={isDark}
                icon={<User size={20} color={isDark ? '#a6b594' : '#6a7d56'} />}
              />
            </Animated.View>

            {/* Allergies */}
            <Animated.View entering={FadeInDown.delay(400).springify()}>
              <MultiSelectSection
                title="Food Allergies"
                subtitle="Important for safety"
                options={ALLERGY_OPTIONS}
                selected={preferences.allergies}
                onToggle={toggleAllergy}
                isDark={isDark}
                icon={<AlertTriangle size={20} color={isDark ? '#f5b8a0' : '#e46d46'} />}
              />
            </Animated.View>

            {/* Account Section */}
            <Animated.View
              entering={FadeInDown.delay(450).springify()}
              className="mt-4"
            >
              <Text className={cn(
                "text-sm font-medium uppercase tracking-wider mb-3",
                isDark ? "text-charcoal-400" : "text-charcoal-500"
              )}>
                Account
              </Text>

              {/* Paused Account Banner */}
              {isPaused && (
                <View className={cn(
                  "rounded-2xl p-4 mb-4 flex-row items-center",
                  isDark ? "bg-amber-900/30" : "bg-amber-50"
                )}>
                  <View className={cn(
                    "w-10 h-10 rounded-xl items-center justify-center mr-3",
                    isDark ? "bg-amber-800/50" : "bg-amber-100"
                  )}>
                    <Pause size={20} color={isDark ? '#fbbf24' : '#d97706'} />
                  </View>
                  <View className="flex-1">
                    <Text className={cn(
                      "text-base font-semibold",
                      isDark ? "text-amber-400" : "text-amber-700"
                    )}>
                      Account Paused
                    </Text>
                    <Text className={cn(
                      "text-sm",
                      isDark ? "text-amber-500/80" : "text-amber-600"
                    )}>
                      Your data is safe. Resume to access features.
                    </Text>
                  </View>
                </View>
              )}

              {/* User Profile Card */}
              {currentUser && (
                <View className={cn(
                  "rounded-2xl p-4 mb-4",
                  isDark ? "bg-charcoal-800/50" : "bg-white"
                )}>
                  <View className="flex-row items-center">
                    <View className={cn(
                      "w-12 h-12 rounded-full items-center justify-center mr-3",
                      isDark ? "bg-sage-600" : "bg-sage-500"
                    )}>
                      <Text className="text-white text-lg font-bold">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className={cn(
                        "text-base font-semibold",
                        isDark ? "text-white" : "text-charcoal-900"
                      )}>
                        {currentUser.name}
                      </Text>
                      <View className="flex-row items-center mt-0.5">
                        <Mail size={12} color={isDark ? '#888888' : '#6d6d6d'} />
                        <Text className={cn(
                          "text-sm ml-1",
                          isDark ? "text-charcoal-400" : "text-charcoal-500"
                        )}>
                          {currentUser.email}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Pause/Resume Account Button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalType(isPaused ? 'resume' : 'pause');
                }}
                className={cn(
                  "rounded-2xl p-4 flex-row items-center mb-3",
                  isPaused
                    ? isDark ? "bg-green-900/30" : "bg-green-50"
                    : isDark ? "bg-amber-900/30" : "bg-amber-50"
                )}
              >
                <View className={cn(
                  "w-10 h-10 rounded-xl items-center justify-center mr-3",
                  isPaused
                    ? isDark ? "bg-green-800/50" : "bg-green-100"
                    : isDark ? "bg-amber-800/50" : "bg-amber-100"
                )}>
                  {isPaused ? (
                    <Play size={20} color={isDark ? '#4ade80' : '#16a34a'} />
                  ) : (
                    <Pause size={20} color={isDark ? '#fbbf24' : '#d97706'} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className={cn(
                    "text-base font-semibold",
                    isPaused
                      ? isDark ? "text-green-400" : "text-green-700"
                      : isDark ? "text-amber-400" : "text-amber-700"
                  )}>
                    {isPaused ? 'Resume Account' : 'Pause Account'}
                  </Text>
                  <Text className={cn(
                    "text-sm",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    {isPaused ? 'Restore full access to your account' : 'Temporarily disable access, keep your data'}
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? '#888888' : '#6d6d6d'} />
              </Pressable>

              {/* Delete Account Button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalType('delete');
                }}
                className={cn(
                  "rounded-2xl p-4 flex-row items-center mb-3",
                  isDark ? "bg-red-900/20" : "bg-red-50"
                )}
              >
                <View className={cn(
                  "w-10 h-10 rounded-xl items-center justify-center mr-3",
                  isDark ? "bg-red-800/30" : "bg-red-100"
                )}>
                  <Trash2 size={20} color={isDark ? '#f87171' : '#dc2626'} />
                </View>
                <View className="flex-1">
                  <Text className={cn(
                    "text-base font-semibold",
                    isDark ? "text-red-400" : "text-red-600"
                  )}>
                    Delete Account
                  </Text>
                  <Text className={cn(
                    "text-sm",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    Permanently delete your account and all data
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? '#888888' : '#6d6d6d'} />
              </Pressable>

              {/* Logout Button */}
              <Pressable
                onPress={handleLogout}
                className={cn(
                  "rounded-2xl p-4 flex-row items-center",
                  isDark ? "bg-charcoal-800/50" : "bg-charcoal-100"
                )}
              >
                <View className={cn(
                  "w-10 h-10 rounded-xl items-center justify-center mr-3",
                  isDark ? "bg-charcoal-700" : "bg-charcoal-200"
                )}>
                  <LogOut size={20} color={isDark ? '#a1a1aa' : '#6b7280'} />
                </View>
                <Text className={cn(
                  "text-base font-semibold",
                  isDark ? "text-charcoal-300" : "text-charcoal-600"
                )}>
                  Sign Out
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Account Management Modal */}
      <AccountManagementModal
        visible={modalType !== null}
        modalType={modalType}
        onClose={() => setModalType(null)}
        onConfirm={handleAccountAction}
        isPaused={isPaused}
      />
    </View>
  );
}
