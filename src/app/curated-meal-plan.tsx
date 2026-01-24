import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { ChevronLeft, Calendar, Clock, Flame, Check, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { useMealPlanStore } from '@/lib/store';
import { CURATED_MEAL_PLANS, CuratedMealPlan, applyCuratedMealPlan } from '@/lib/curated-meal-plans';

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface MealPlanCardProps {
  plan: CuratedMealPlan;
  onSelect: () => void;
  isDark: boolean;
  index: number;
}

function MealPlanCard({ plan, onSelect, isDark, index }: MealPlanCardProps) {
  const durationDays = parseInt(plan.duration.split('-')[0]);
  const mealsPerDay = Math.round(plan.meals.length / durationDays);
  const avgCalories = Math.round(plan.totalCalories / durationDays);

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSelect();
        }}
        className={cn(
          "rounded-3xl overflow-hidden mb-4",
          isDark ? "bg-charcoal-800" : "bg-white"
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        <Image
          source={{ uri: plan.imageUrl }}
          className="w-full h-44"
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)']}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 176,
          }}
        />

        {/* Title and Description - Positioned at Top */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: 16,
            paddingTop: 20,
            paddingBottom: 24,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
          }}
        >
          <Text className={cn(
            "text-xl font-bold mb-1",
            "text-white"
          )}>
            {plan.name}
          </Text>
          <Text className={cn(
            "text-sm leading-5",
            "text-white/90"
          )} numberOfLines={2}>
            {plan.description}
          </Text>
        </View>

        {/* Duration Badge */}
        <View
          className={cn(
            "absolute top-4 right-4 px-3 py-1.5 rounded-full",
            isDark ? "bg-sage-600" : "bg-sage-500"
          )}
        >
          <Text className="text-white text-sm font-semibold">
            {plan.duration}
          </Text>
        </View>

        <View className="p-5">
          {/* Tags */}
          <View className="flex-row flex-wrap gap-2 mb-4">
            {plan.tags.map((tag, i) => (
              <View
                key={i}
                className={cn(
                  "px-3 py-1 rounded-full",
                  isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}
              >
                <Text className={cn(
                  "text-xs font-medium",
                  isDark ? "text-charcoal-300" : "text-charcoal-600"
                )}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>

          {/* Stats */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Calendar size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
              <Text className={cn(
                "text-sm ml-1.5",
                isDark ? "text-charcoal-300" : "text-charcoal-600"
              )}>
                {durationDays} days
              </Text>
            </View>
            <View className="flex-row items-center">
              <Clock size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
              <Text className={cn(
                "text-sm ml-1.5",
                isDark ? "text-charcoal-300" : "text-charcoal-600"
              )}>
                {mealsPerDay} meals/day
              </Text>
            </View>
            <View className="flex-row items-center">
              <Flame size={16} color={isDark ? '#e57373' : '#d32f2f'} />
              <Text className={cn(
                "text-sm ml-1.5",
                isDark ? "text-charcoal-300" : "text-charcoal-600"
              )}>
                ~{avgCalories} cal/day
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function CuratedMealPlanScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const addRecipe = useMealPlanStore((s) => s.addRecipe);
  const addMealToSlot = useMealPlanStore((s) => s.addMealToSlot);
  const selectedDate = useMealPlanStore((s) => s.selectedDate);

  const [selectedPlan, setSelectedPlan] = useState<CuratedMealPlan | null>(null);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date>(new Date());

  const handleSelectPlan = useCallback((plan: CuratedMealPlan) => {
    setSelectedPlan(plan);
    setSelectedStartDate(new Date()); // Reset to today
    setIsConfirmModalVisible(true);
  }, []);

  const handleApplyPlan = useCallback(async () => {
    if (!selectedPlan) return;

    setIsApplying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Apply the meal plan starting from the selected date
      const dateKey = formatDateKey(selectedStartDate);

      // Clear any existing meals for the duration of this plan
      const durationDays = parseInt(selectedPlan.duration.split('-')[0]);
      const endDate = new Date(selectedStartDate);
      endDate.setDate(endDate.getDate() + durationDays);

      // Clear all meals in the date range
      const mealSlots = useMealPlanStore.getState().mealSlots;
      mealSlots.forEach((slot) => {
        const slotDate = new Date(slot.date);
        if (slotDate >= selectedStartDate && slotDate < endDate) {
          useMealPlanStore.getState().removeMealFromSlot(slot.id);
        }
      });

      applyCuratedMealPlan(selectedPlan, dateKey, addRecipe, addMealToSlot);

      setIsApplying(false);
      setIsSuccess(true);

      // Show success for a moment then close
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsConfirmModalVisible(false);
      setIsSuccess(false);
      setSelectedPlan(null);

      // Navigate back to meal plan
      router.back();
    } catch (error) {
      setIsApplying(false);
      Alert.alert('Error', 'Failed to apply meal plan. Please try again.');
    }
  }, [selectedPlan, selectedStartDate, addRecipe, addMealToSlot, router]);

  const handleCloseModal = useCallback(() => {
    if (isApplying) return;
    setIsConfirmModalVisible(false);
    setSelectedPlan(null);
  }, [isApplying]);

  return (
    <View className={cn("flex-1", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <LinearGradient
        colors={isDark ? ['#2f3628', '#262626'] : ['#e3e7dd', '#fefdfb']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.springify()}
          className="flex-row items-center px-4 py-3"
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className={cn(
              "w-10 h-10 rounded-full items-center justify-center",
              isDark ? "bg-charcoal-800" : "bg-white"
            )}
          >
            <ChevronLeft size={24} color={isDark ? '#fff' : '#262626'} />
          </Pressable>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Title Section */}
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            className="px-5 mb-6"
          >
            <View className="flex-row items-center mb-2">
              <Sparkles size={24} color={isDark ? '#a6b594' : '#6a7d56'} />
              <Text className={cn(
                "text-sm font-semibold uppercase tracking-wider ml-2",
                isDark ? "text-sage-400" : "text-sage-600"
              )}>
                Curated Plans
              </Text>
            </View>
            <Text className={cn(
              "text-2xl font-bold",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              Choose Your Meal Plan
            </Text>
            <Text className={cn(
              "text-base mt-2",
              isDark ? "text-charcoal-400" : "text-charcoal-500"
            )}>
              Select a predefined meal plan to automatically fill your calendar with delicious recipes.
            </Text>
          </Animated.View>

          {/* Meal Plans */}
          <View className="px-5">
            {CURATED_MEAL_PLANS.map((plan, index) => (
              <MealPlanCard
                key={plan.id}
                plan={plan}
                onSelect={() => handleSelectPlan(plan)}
                isDark={isDark}
                index={index}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Confirmation Modal */}
      <Modal
        visible={isConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <Animated.View
            entering={FadeInUp.springify()}
            className={cn(
              "w-full rounded-3xl overflow-hidden",
              isDark ? "bg-charcoal-800" : "bg-white"
            )}
          >
            {selectedPlan && (
              <>
                {!isSuccess && (
                  <>
                    <Text className={cn(
                      "text-2xl font-bold px-6 pt-6",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {selectedPlan.name}
                    </Text>
                  </>
                )}
                <Image
                  source={{ uri: selectedPlan.imageUrl }}
                  className="w-full h-32"
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', isDark ? 'rgba(38,38,38,1)' : 'rgba(255,255,255,1)']}
                  style={{
                    position: 'absolute',
                    top: 64,
                    left: 0,
                    right: 0,
                    height: 64,
                  }}
                />

                <View className="p-6">
                  {isSuccess ? (
                    <Animated.View
                      entering={FadeIn.springify()}
                      className="items-center py-8"
                    >
                      <View className={cn(
                        "w-20 h-20 rounded-full items-center justify-center mb-4",
                        isDark ? "bg-sage-700" : "bg-sage-100"
                      )}>
                        <Check size={40} color={isDark ? '#fff' : '#6a7d56'} strokeWidth={2.5} />
                      </View>
                      <Text className={cn(
                        "text-xl font-bold text-center",
                        isDark ? "text-white" : "text-charcoal-900"
                      )}>
                        Meal Plan Applied!
                      </Text>
                      <Text className={cn(
                        "text-base text-center mt-2",
                        isDark ? "text-charcoal-400" : "text-charcoal-500"
                      )}>
                        Your calendar has been updated with {selectedPlan.meals.length} meals.
                      </Text>
                    </Animated.View>
                  ) : (
                    <>
                      <Text className={cn(
                        "text-base mt-2 mb-4",
                        isDark ? "text-charcoal-400" : "text-charcoal-500"
                      )}>
                        {selectedPlan.description}
                      </Text>

                      {/* Plan Details */}
                      <View className={cn(
                        "p-4 rounded-2xl mb-6",
                        isDark ? "bg-charcoal-700" : "bg-cream-100"
                      )}>
                        <Text className={cn(
                          "text-sm font-semibold mb-3",
                          isDark ? "text-charcoal-300" : "text-charcoal-600"
                        )}>
                          This plan includes:
                        </Text>
                        <View className="flex-row items-center mb-2">
                          <Calendar size={18} color={isDark ? '#a6b594' : '#6a7d56'} />
                          <Text className={cn(
                            "text-base ml-3",
                            isDark ? "text-white" : "text-charcoal-800"
                          )}>
                            {selectedPlan.duration}
                          </Text>
                        </View>
                        <View className="flex-row items-center mb-2">
                          <Clock size={18} color={isDark ? '#a6b594' : '#6a7d56'} />
                          <Text className={cn(
                            "text-base ml-3",
                            isDark ? "text-white" : "text-charcoal-800"
                          )}>
                            {selectedPlan.meals.length} total meals
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Flame size={18} color={isDark ? '#e57373' : '#d32f2f'} />
                          <Text className={cn(
                            "text-base ml-3",
                            isDark ? "text-white" : "text-charcoal-800"
                          )}>
                            {selectedPlan.totalCalories.toLocaleString()} total calories
                          </Text>
                        </View>
                      </View>

                      {/* Start Date Selector */}
                      <View className="mb-6">
                        <Text className={cn(
                          "text-sm font-semibold mb-3",
                          isDark ? "text-charcoal-300" : "text-charcoal-600"
                        )}>
                          Start Date
                        </Text>
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          className={cn(
                            "p-4 rounded-2xl flex-row items-center justify-between",
                            isDark ? "bg-charcoal-700" : "bg-cream-100"
                          )}
                        >
                          <View className="flex-row items-center">
                            <Calendar size={18} color={isDark ? '#a6b594' : '#6a7d56'} />
                            <Text className={cn(
                              "text-base ml-3 font-semibold",
                              isDark ? "text-white" : "text-charcoal-800"
                            )}>
                              {selectedStartDate.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </Text>
                          </View>
                          <View className="flex-row gap-2">
                            <Pressable
                              onPress={() => {
                                const newDate = new Date(selectedStartDate);
                                newDate.setDate(newDate.getDate() - 1);
                                setSelectedStartDate(newDate);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              className={cn(
                                "w-10 h-10 rounded-lg items-center justify-center",
                                isDark ? "bg-charcoal-600" : "bg-white"
                              )}
                            >
                              <ChevronUp size={20} color={isDark ? '#fff' : '#262626'} />
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                const newDate = new Date(selectedStartDate);
                                newDate.setDate(newDate.getDate() + 1);
                                setSelectedStartDate(newDate);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              className={cn(
                                "w-10 h-10 rounded-lg items-center justify-center",
                                isDark ? "bg-charcoal-600" : "bg-white"
                              )}
                            >
                              <ChevronDown size={20} color={isDark ? '#fff' : '#262626'} />
                            </Pressable>
                          </View>
                        </Pressable>
                      </View>

                      {/* Buttons */}
                      <View className="flex-row space-x-3">
                        <Pressable
                          onPress={handleCloseModal}
                          disabled={isApplying}
                          className={cn(
                            "flex-1 py-4 rounded-2xl items-center justify-center",
                            isDark ? "bg-charcoal-700" : "bg-cream-200",
                            isApplying && "opacity-50"
                          )}
                        >
                          <Text className={cn(
                            "text-base font-semibold",
                            isDark ? "text-white" : "text-charcoal-800"
                          )}>
                            Cancel
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={handleApplyPlan}
                          disabled={isApplying}
                          className={cn(
                            "flex-1 py-4 rounded-2xl items-center justify-center",
                            isDark ? "bg-sage-600" : "bg-sage-500",
                            isApplying && "opacity-70"
                          )}
                        >
                          {isApplying ? (
                            <Text className="text-white text-base font-semibold">
                              Applying...
                            </Text>
                          ) : (
                            <Text className="text-white text-base font-semibold">
                              Apply Plan
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
