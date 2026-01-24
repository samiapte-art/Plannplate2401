import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, GestureResponderEvent, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Link } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Utensils, Coffee, Sun, Moon, RefreshCw, Trash2, Lock, Sparkles, ArrowLeftRight, Edit } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMealPlanStore, type MealSlot, type Recipe } from '@/lib/store';
import { useIsAccountPaused } from '@/lib/subscription-store';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { PausedFeatureBanner } from '@/components/PausedFeatureBanner';
import { ServingAdjustmentModal } from '@/components/ServingAdjustmentModal';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee },
  { key: 'lunch', label: 'Lunch', icon: Sun },
  { key: 'dinner', label: 'Dinner', icon: Moon },
  { key: 'snack', label: 'Snack', icon: Utensils },
] as const;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekDates(baseDate: Date): Date[] {
  const startOfWeek = new Date(baseDate);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface MealCardProps {
  slots: MealSlot[];
  recipes: Recipe[];
  mealType: typeof MEAL_TYPES[number];
  onAddRecipe: () => void;
  onSwapRecipe: (slot: MealSlot) => void;
  onViewRecipes: () => void;
  onViewRecipe?: (recipeId: string, slotId?: string) => void;
  onOpenServingModal?: (slot: MealSlot, recipe: Recipe) => void;
  onDeleteRecipe?: (slot: MealSlot) => void;
  isDark: boolean;
  index: number;
  isRestricted?: boolean;
}

function MealCard({ slots, recipes, mealType, onAddRecipe, onSwapRecipe, onViewRecipes, onViewRecipe, onOpenServingModal, onDeleteRecipe, isDark, index, isRestricted = false }: MealCardProps) {
  const Icon = mealType.icon;
  const hasRecipes = slots.length > 0 && recipes.length > 0;
  const recipeCount = recipes.length;
  const firstRecipe = recipes[0];
  const firstSlot = slots[0];
  const isSingleRecipe = recipeCount === 1;

  const swipeStartX = useRef(0);
  const SWIPE_THRESHOLD = 50; // Minimum distance to trigger delete (pixels)

  const handleSwipeStart = useCallback((x: number) => {
    swipeStartX.current = x;
  }, []);

  const handleSwipeEnd = useCallback((x: number) => {
    // Swipe right (positive delta)
    const delta = x - swipeStartX.current;

    if (isSingleRecipe && !isRestricted && firstSlot && delta > SWIPE_THRESHOLD) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDeleteRecipe?.(firstSlot);
    }
  }, [isSingleRecipe, firstSlot, isRestricted, onDeleteRecipe]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hasRecipes) {
      // Always open the modal to manage recipes (edit, swap, delete)
      onViewRecipes();
    } else if (!isRestricted) {
      onAddRecipe();
    }
  }, [hasRecipes, onViewRecipes, onAddRecipe, isRestricted]);

  const handleAddRecipe = useCallback(() => {
    if (isRestricted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddRecipe();
  }, [onAddRecipe, isRestricted]);

  const handleSwapRecipe = useCallback(() => {
    if (isRestricted || !firstSlot) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSwapRecipe(firstSlot);
  }, [onSwapRecipe, firstSlot, isRestricted]);

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).springify()}>
      <View
        className={cn(
          "flex-row items-center p-3 rounded-2xl mb-2",
          isDark ? "bg-charcoal-800/50" : "bg-cream-100",
          hasRecipes && (isDark ? "bg-sage-900/30" : "bg-sage-50")
        )}
      >
        <View className={cn(
          "w-10 h-10 rounded-xl items-center justify-center mr-3",
          isDark ? "bg-charcoal-700" : "bg-cream-200"
        )}>
          <Icon size={18} color={isDark ? '#a6b594' : '#6a7d56'} strokeWidth={1.8} />
        </View>

        {hasRecipes && firstRecipe ? (
          <Pressable
            onPress={handlePress}
            onPressIn={(e) => handleSwipeStart(e.nativeEvent.pageX)}
            onPressOut={(e) => handleSwipeEnd(e.nativeEvent.pageX)}
            className="flex-1 flex-row items-center"
          >
            <Image
              source={{ uri: firstRecipe.imageUrl }}
              className="w-12 h-12 rounded-xl mr-3"
            />
            <View className="flex-1">
              <Text className={cn(
                "text-base font-semibold",
                isDark ? "text-white" : "text-charcoal-900"
              )} numberOfLines={1}>
                {firstRecipe.name}
              </Text>
              <Text className={cn(
                "text-sm",
                isDark ? "text-charcoal-400" : "text-charcoal-500"
              )}>
                {firstRecipe.cookTime + firstRecipe.prepTime} min • {firstRecipe.calories} cal
              </Text>
            </View>
            {/* Recipe Count Badge - shows when multiple recipes */}
            {recipeCount > 1 && (
              <View className={cn(
                "px-2.5 py-1 rounded-full",
                isDark ? "bg-sage-700" : "bg-sage-200"
              )}>
                <Text className={cn(
                  "text-xs font-bold",
                  isDark ? "text-sage-100" : "text-sage-800"
                )}>
                  +{recipeCount - 1}
                </Text>
              </View>
            )}
          </Pressable>
        ) : (
          <Pressable onPress={handlePress} className="flex-1 flex-row items-center">
            <Text className={cn(
              "text-base flex-1",
              isDark ? "text-charcoal-400" : "text-charcoal-500",
              isRestricted && "opacity-60"
            )}>
              {isRestricted ? 'Meal planning paused' : `Add ${mealType.label.toLowerCase()}`}
            </Text>
            <View className={cn(
              "w-8 h-8 rounded-full items-center justify-center",
              isDark ? "bg-charcoal-700" : "bg-cream-200",
              isRestricted && (isDark ? "bg-amber-900/30" : "bg-amber-100")
            )}>
              {isRestricted ? (
                <Lock size={14} color={isDark ? '#fbbf24' : '#d97706'} />
              ) : (
                <Plus size={16} color={isDark ? '#888888' : '#6d6d6d'} />
              )}
            </View>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default function MealPlanScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isPaused = useIsAccountPaused();

  const selectedDate = useMealPlanStore((s) => s.selectedDate);
  const setSelectedDate = useMealPlanStore((s) => s.setSelectedDate);
  const mealSlots = useMealPlanStore((s) => s.mealSlots);
  const recipes = useMealPlanStore((s) => s.recipes);
  const removeMealFromSlot = useMealPlanStore((s) => s.removeMealFromSlot);
  const updateMealSlot = useMealPlanStore((s) => s.updateMealSlot);

  // Set today's date when the screen loads
  useEffect(() => {
    const today = formatDateKey(new Date());
    setSelectedDate(today);
  }, [setSelectedDate]);

  const baseDate = useMemo(() => new Date(selectedDate), [selectedDate]);
  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

  const currentDateSlots = useMemo(() => {
    return mealSlots.filter((s) => s.date === selectedDate);
  }, [mealSlots, selectedDate]);

  // Modal state for viewing all recipes in a meal type
  const [recipesModal, setRecipesModal] = useState<{
    visible: boolean;
    mealType: typeof MEAL_TYPES[number] | null;
  }>({ visible: false, mealType: null });

  // Modal state for serving adjustment
  const [servingModal, setServingModal] = useState<{
    visible: boolean;
    slotId: string | null;
    recipe: Recipe | null;
    servingOverride: number | undefined;
  }>({ visible: false, slotId: null, recipe: null, servingOverride: undefined });

  // Compute modal slots and recipes from store (stays updated when store changes)
  const modalSlots = useMemo(() => {
    if (!recipesModal.mealType) return [];
    return currentDateSlots.filter((s) => s.mealType === recipesModal.mealType?.key && s.recipeId);
  }, [currentDateSlots, recipesModal.mealType]);

  const modalRecipes = useMemo(() => {
    return modalSlots
      .map((slot) => recipes.find((r) => r.id === slot.recipeId))
      .filter((r): r is Recipe => r !== undefined);
  }, [modalSlots, recipes]);

  // Get all slots for a specific meal type on the selected date
  const getSlotsForMealType = useCallback((mealType: string) => {
    return currentDateSlots.filter((s) => s.mealType === mealType && s.recipeId);
  }, [currentDateSlots]);

  // Get all recipes for slots of a specific meal type
  const getRecipesForMealType = useCallback((mealType: string) => {
    const slots = getSlotsForMealType(mealType);
    return slots
      .map((slot) => recipes.find((r) => r.id === slot.recipeId))
      .filter((r): r is Recipe => r !== undefined);
  }, [getSlotsForMealType, recipes]);

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(formatDateKey(newDate));
  }, [selectedDate, setSelectedDate]);

  const selectDate = useCallback((date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(formatDateKey(date));
  }, [setSelectedDate]);

  const handleMealSlotPress = useCallback((mealType: string, date: string) => {
    router.push({
      pathname: '/select-recipe',
      params: { mealType, date }
    });
  }, [router]);

  const handleViewRecipe = useCallback((recipeId: string, slotId?: string) => {
    router.push({
      pathname: '/recipe-detail',
      params: { id: recipeId, slotId: slotId ?? '' }
    });
  }, [router]);

  const handleRemoveMeal = useCallback((slotId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeMealFromSlot(slotId);
  }, [removeMealFromSlot]);

  const handleDeleteSingleRecipe = useCallback((slot: MealSlot) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    removeMealFromSlot(slot.id);
  }, [removeMealFromSlot]);

  const handleOpenServingModal = useCallback((slot: MealSlot, recipe: Recipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setServingModal({
      visible: true,
      slotId: slot.id,
      recipe,
      servingOverride: slot.servingOverride,
    });
  }, []);

  const handleSaveServingSize = useCallback((slotId: string, servingSize: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateMealSlot(slotId, { servingOverride: servingSize });
    setServingModal({ visible: false, slotId: null, recipe: null, servingOverride: undefined });
  }, [updateMealSlot]);

  const closeServingModal = useCallback(() => {
    setServingModal({ visible: false, slotId: null, recipe: null, servingOverride: undefined });
  }, []);

  const handleSwapRecipe = useCallback((slot: MealSlot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/select-recipe',
      params: { mealType: slot.mealType, date: slot.date, swap: 'true', slotId: slot.id }
    });
  }, [router]);

  const openRecipesModal = useCallback((mealType: typeof MEAL_TYPES[number]) => {
    setRecipesModal({
      visible: true,
      mealType,
    });
  }, []);

  const closeRecipesModal = useCallback(() => {
    setRecipesModal({ visible: false, mealType: null });
  }, []);

  const today = formatDateKey(new Date());
  const selectedDateObj = new Date(selectedDate);
  const monthYear = selectedDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dayOfWeek = FULL_DAYS[selectedDateObj.getDay()];
  const dayNumber = selectedDateObj.getDate();

  // Calculate weekly stats
  const weeklyStats = useMemo(() => {
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    const slotsThisWeek = mealSlots.filter((s) => {
      const slotDate = new Date(s.date);
      return slotDate >= weekStart && slotDate <= weekEnd && s.recipeId;
    });
    const totalMeals = 7 * 3; // 7 days * 3 main meals
    const plannedMeals = slotsThisWeek.filter(s =>
      s.mealType !== 'snack'
    ).length;
    return { planned: plannedMeals, total: totalMeals };
  }, [weekDates, mealSlots]);

  return (
    <View className={cn("flex-1", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
      <LinearGradient
        colors={isDark ? ['#2f3628', '#262626'] : ['#e3e7dd', '#fefdfb']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            className="px-5 pt-4 pb-2"
          >
            <Text className={cn(
              "text-sm font-medium uppercase tracking-wider",
              isDark ? "text-sage-400" : "text-sage-600"
            )}>
              Your Meal Plan
            </Text>
            <Text className={cn(
              "text-3xl font-bold mt-1",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              {monthYear}
            </Text>
          </Animated.View>

          {/* Week Navigation */}
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            className="flex-row items-center justify-between px-5 mt-4"
          >
            <Pressable
              onPress={() => navigateWeek('prev')}
              className={cn(
                "w-10 h-10 rounded-full items-center justify-center",
                isDark ? "bg-charcoal-800" : "bg-white"
              )}
            >
              <ChevronLeft size={20} color={isDark ? '#fff' : '#262626'} />
            </Pressable>

            <View className="flex-row items-center">
              <Text className={cn(
                "text-base font-medium",
                isDark ? "text-charcoal-300" : "text-charcoal-600"
              )}>
                Week {getWeekNumber(selectedDateObj)}
              </Text>
              <View className={cn(
                "ml-3 px-3 py-1 rounded-full",
                isDark ? "bg-sage-800" : "bg-sage-100"
              )}>
                <Text className={cn(
                  "text-sm font-semibold",
                  isDark ? "text-sage-200" : "text-sage-700"
                )}>
                  {weeklyStats.planned}/{weeklyStats.total} meals
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => navigateWeek('next')}
              className={cn(
                "w-10 h-10 rounded-full items-center justify-center",
                isDark ? "bg-charcoal-800" : "bg-white"
              )}
            >
              <ChevronRight size={20} color={isDark ? '#fff' : '#262626'} />
            </Pressable>
          </Animated.View>

          {/* Day Selector */}
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            className="mt-5"
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {weekDates.map((date, index) => {
                const dateKey = formatDateKey(date);
                const isSelected = dateKey === selectedDate;
                const isToday = dateKey === today;
                const hasPlannedMeals = mealSlots.some(
                  (s) => s.date === dateKey && s.recipeId
                );

                return (
                  <Pressable
                    key={dateKey}
                    onPress={() => selectDate(date)}
                    className={cn(
                      "items-center mr-3 py-3 px-4 rounded-2xl",
                      isSelected
                        ? isDark ? "bg-sage-600" : "bg-sage-500"
                        : isDark ? "bg-charcoal-800/50" : "bg-white",
                      isToday && !isSelected && "border-2 border-sage-400"
                    )}
                  >
                    <Text className={cn(
                      "text-xs font-medium uppercase",
                      isSelected
                        ? "text-white"
                        : isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      {DAYS[date.getDay()]}
                    </Text>
                    <Text className={cn(
                      "text-xl font-bold mt-1",
                      isSelected
                        ? "text-white"
                        : isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {date.getDate()}
                    </Text>
                    {hasPlannedMeals && !isSelected && (
                      <View className={cn(
                        "w-1.5 h-1.5 rounded-full mt-1",
                        isDark ? "bg-sage-400" : "bg-sage-500"
                      )} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Selected Day Header */}
          <Animated.View
            entering={FadeInDown.delay(250).springify()}
            className="px-5 mt-6 mb-3"
          >
            <Text className={cn(
              "text-2xl font-bold",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              {dayOfWeek}, {dayNumber}
            </Text>
            <Text className={cn(
              "text-sm mt-1",
              isDark ? "text-charcoal-400" : "text-charcoal-500"
            )}>
              {currentDateSlots.filter(s => s.recipeId).length} meals planned
            </Text>
          </Animated.View>

          {/* Meal Slots */}
          <View className="px-5">
            {isPaused && (
              <View className="mb-3">
                <PausedFeatureBanner
                  message="Meal planning is disabled while your account is paused"
                  compact
                />
              </View>
            )}
            {MEAL_TYPES.map((mealType, index) => {
              const slotsForType = getSlotsForMealType(mealType.key);
              const recipesForType = getRecipesForMealType(mealType.key);

              return (
                <MealCard
                  key={mealType.key}
                  slots={slotsForType}
                  recipes={recipesForType}
                  mealType={mealType}
                  onAddRecipe={() => handleMealSlotPress(mealType.key, selectedDate)}
                  onSwapRecipe={handleSwapRecipe}
                  onViewRecipes={() => openRecipesModal(mealType)}
                  onViewRecipe={handleViewRecipe}
                  onOpenServingModal={handleOpenServingModal}
                  onDeleteRecipe={handleDeleteSingleRecipe}
                  isDark={isDark}
                  index={index}
                  isRestricted={isPaused}
                />
              );
            })}
          </View>

          {/* Quick Actions */}
          <Animated.View
            entering={FadeInDown.delay(400).springify()}
            className="px-5 mt-6"
          >
            <Text className={cn(
              "text-lg font-semibold mb-3",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              Quick Actions
            </Text>
            {/* First Row - Two buttons */}
            <View className="flex-row space-x-3 mb-3">
              <Pressable
                onPress={() => {
                  if (isPaused) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/generate-recipe');
                }}
                className={cn(
                  "flex-1 p-4 rounded-2xl",
                  isPaused
                    ? isDark ? "bg-amber-900/20" : "bg-amber-50"
                    : isDark ? "bg-terracotta-800/30" : "bg-terracotta-50"
                )}
              >
                <View className="flex-row items-center">
                  {isPaused && <Lock size={14} color={isDark ? '#fbbf24' : '#d97706'} className="mr-2" />}
                  <Text className={cn(
                    "text-base font-semibold",
                    isPaused
                      ? isDark ? "text-amber-400" : "text-amber-700"
                      : isDark ? "text-terracotta-300" : "text-terracotta-700"
                  )}>
                    {isPaused ? ' Paused' : 'Generate Recipe'}
                  </Text>
                </View>
                <Text className={cn(
                  "text-sm mt-1",
                  isPaused
                    ? isDark ? "text-amber-500/70" : "text-amber-600"
                    : isDark ? "text-terracotta-400" : "text-terracotta-500"
                )}>
                  {isPaused ? 'Resume to access AI' : 'AI-powered suggestions'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (isPaused) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/grocery');
                }}
                className={cn(
                  "flex-1 p-4 rounded-2xl",
                  isPaused
                    ? isDark ? "bg-amber-900/20" : "bg-amber-50"
                    : isDark ? "bg-sage-800/30" : "bg-sage-50"
                )}
              >
                <View className="flex-row items-center">
                  {isPaused && <Lock size={14} color={isDark ? '#fbbf24' : '#d97706'} className="mr-2" />}
                  <Text className={cn(
                    "text-base font-semibold",
                    isPaused
                      ? isDark ? "text-amber-400" : "text-amber-700"
                      : isDark ? "text-sage-300" : "text-sage-700"
                  )}>
                    {isPaused ? ' Paused' : 'Grocery List'}
                  </Text>
                </View>
                <Text className={cn(
                  "text-sm mt-1",
                  isPaused
                    ? isDark ? "text-amber-500/70" : "text-amber-600"
                    : isDark ? "text-sage-400" : "text-sage-500"
                )}>
                  {isPaused ? 'Resume to generate list' : 'From your meal plan'}
                </Text>
              </Pressable>
            </View>
            {/* Second Row - Curated Meal Plan */}
            <Pressable
              onPress={() => {
                if (isPaused) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/curated-meal-plan');
              }}
              className={cn(
                "p-4 rounded-2xl flex-row items-center justify-between",
                isPaused
                  ? isDark ? "bg-amber-900/20" : "bg-amber-50"
                  : isDark ? "bg-indigo-900/30" : "bg-indigo-50"
              )}
            >
              <View className="flex-1">
                <View className="flex-row items-center">
                  {isPaused ? (
                    <Lock size={14} color={isDark ? '#fbbf24' : '#d97706'} />
                  ) : (
                    <Sparkles size={16} color={isDark ? '#a5b4fc' : '#6366f1'} />
                  )}
                  <Text className={cn(
                    "text-base font-semibold ml-2",
                    isPaused
                      ? isDark ? "text-amber-400" : "text-amber-700"
                      : isDark ? "text-indigo-300" : "text-indigo-700"
                  )}>
                    {isPaused ? 'Paused' : 'Curated Meal Plan'}
                  </Text>
                </View>
                <Text className={cn(
                  "text-sm mt-1",
                  isPaused
                    ? isDark ? "text-amber-500/70" : "text-amber-600"
                    : isDark ? "text-indigo-400" : "text-indigo-500"
                )}>
                  {isPaused ? 'Resume to access plans' : 'Choose from predefined meal plans'}
                </Text>
              </View>
              <View className={cn(
                "w-10 h-10 rounded-full items-center justify-center",
                isPaused
                  ? isDark ? "bg-amber-800/30" : "bg-amber-100"
                  : isDark ? "bg-indigo-800/50" : "bg-indigo-100"
              )}>
                <ChevronRight
                  size={20}
                  color={isPaused
                    ? isDark ? '#fbbf24' : '#d97706'
                    : isDark ? '#a5b4fc' : '#6366f1'
                  }
                />
              </View>
            </Pressable>
          </Animated.View>

          {/* Suggested Recipes */}
          {recipes.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(450).springify()}
              className="mt-6"
            >
              <View className="flex-row items-center justify-between px-5 mb-3">
                <Text className={cn(
                  "text-lg font-semibold",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Quick Add
                </Text>
                <Pressable onPress={() => router.push('/(tabs)/recipes')}>
                  <Text className={cn(
                    "text-sm font-medium",
                    isDark ? "text-sage-400" : "text-sage-600"
                  )}>
                    See all
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                {recipes.slice(0, 5).map((recipe) => (
                  <Pressable
                    key={recipe.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({
                        pathname: '/recipe-detail',
                        params: { id: recipe.id }
                      });
                    }}
                    className={cn(
                      "mr-4 rounded-2xl overflow-hidden",
                      isDark ? "bg-charcoal-800" : "bg-white"
                    )}
                    style={{ width: 160 }}
                  >
                    <Image
                      source={{ uri: recipe.imageUrl }}
                      className="w-full h-24"
                    />
                    <View className="p-3">
                      <Text className={cn(
                        "text-sm font-semibold",
                        isDark ? "text-white" : "text-charcoal-900"
                      )} numberOfLines={1}>
                        {recipe.name}
                      </Text>
                      <Text className={cn(
                        "text-xs mt-1",
                        isDark ? "text-charcoal-400" : "text-charcoal-500"
                      )}>
                        {recipe.cookTime + recipe.prepTime} min
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Recipes Modal - Shows all recipes for a meal type */}
      <Modal
        visible={recipesModal.visible}
        transparent
        animationType="slide"
        onRequestClose={closeRecipesModal}
      >
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={closeRecipesModal}>
          <View
            className={cn(
              "rounded-t-3xl max-h-[80%]",
              isDark ? "bg-charcoal-900" : "bg-white"
            )}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View className={cn(
              "flex-row items-center justify-center px-5 py-4 border-b",
              isDark ? "border-charcoal-800" : "border-cream-200"
            )}>
              <View className="flex-row items-center">
                {recipesModal.mealType && (
                  <>
                    {React.createElement(recipesModal.mealType.icon, {
                      size: 20,
                      color: isDark ? '#a6b594' : '#6a7d56',
                    })}
                    <Text className={cn(
                      "text-lg font-semibold ml-2",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {recipesModal.mealType.label}
                    </Text>
                  </>
                )}
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  closeRecipesModal();
                  if (recipesModal.mealType) {
                    handleMealSlotPress(recipesModal.mealType.key, selectedDate);
                  }
                }}
                className={cn(
                  "w-10 h-10 rounded-full items-center justify-center ml-auto",
                  isDark ? "bg-sage-700" : "bg-sage-100"
                )}
              >
                <Plus size={20} color={isDark ? '#fff' : '#6a7d56'} />
              </Pressable>
            </View>

            {/* Recipe List */}
            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
            >
              {modalRecipes.length > 0 ? (
                modalRecipes.map((recipe, index) => {
                  const slot = modalSlots[index];
                  if (!slot) return null;

                  const displayServings = slot.servingOverride ?? recipe.servings;

                  return (
                    <View
                      key={slot.id}
                      className={cn(
                        "flex-row items-center p-3 rounded-2xl mb-3",
                        isDark ? "bg-charcoal-800" : "bg-cream-50"
                      )}
                    >
                      <Pressable
                        onPress={() => {
                          closeRecipesModal();
                          handleViewRecipe(recipe.id);
                        }}
                        className="flex-1 flex-row items-center"
                      >
                        <Image
                          source={{ uri: recipe.imageUrl }}
                          className="w-16 h-16 rounded-xl mr-4"
                        />
                        <View className="flex-1">
                          <Text className={cn(
                            "text-base font-semibold",
                            isDark ? "text-white" : "text-charcoal-900"
                          )} numberOfLines={1}>
                            {recipe.name}
                          </Text>
                          <Text
                            className={cn(
                              "text-sm mt-1",
                              isDark ? "text-charcoal-400" : "text-charcoal-500"
                            )}
                            numberOfLines={1}
                          >
                            {recipe.description}
                          </Text>
                          <View className="flex-row items-center mt-2">
                            <Text className={cn(
                              "text-xs",
                              isDark ? "text-charcoal-500" : "text-charcoal-400"
                            )}>
                              {recipe.cookTime + recipe.prepTime} min
                            </Text>
                            <Text className={cn(
                              "text-xs mx-2",
                              isDark ? "text-charcoal-600" : "text-charcoal-300"
                            )}>
                              •
                            </Text>
                            <Text className={cn(
                              "text-xs",
                              isDark ? "text-charcoal-500" : "text-charcoal-400"
                            )}>
                              {recipe.calories} cal
                            </Text>
                            <Text className={cn(
                              "text-xs mx-2",
                              isDark ? "text-charcoal-600" : "text-charcoal-300"
                            )}>
                              •
                            </Text>
                            <Text className={cn(
                              "text-xs font-semibold",
                              isDark ? "text-sage-400" : "text-sage-600"
                            )}>
                              {displayServings} {displayServings === 1 ? 'serving' : 'servings'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                      {/* Serving Adjustment Button */}
                      <Pressable
                        onPress={() => {
                          handleOpenServingModal(slot, recipe);
                        }}
                        className={cn(
                          "w-9 h-9 rounded-full items-center justify-center ml-1.5 flex-shrink-0",
                          isDark ? "bg-charcoal-700" : "bg-cream-200"
                        )}
                      >
                        <Edit size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                      </Pressable>
                      {/* Swap Button */}
                      <Pressable
                        onPress={() => {
                          closeRecipesModal();
                          handleSwapRecipe(slot);
                        }}
                        className={cn(
                          "w-9 h-9 rounded-full items-center justify-center ml-1.5 flex-shrink-0",
                          isDark ? "bg-charcoal-700" : "bg-cream-200"
                        )}
                      >
                        <RefreshCw size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                      </Pressable>
                      {/* Remove Button */}
                      <Pressable
                        onPress={() => {
                          handleRemoveMeal(slot.id);
                        }}
                        className={cn(
                          "w-9 h-9 rounded-full items-center justify-center ml-1 flex-shrink-0",
                          isDark ? "bg-charcoal-700" : "bg-cream-200"
                        )}
                      >
                        <Trash2 size={16} color={isDark ? '#e57373' : '#d32f2f'} />
                      </Pressable>
                    </View>
                  );
                })
              ) : (
                <View className="items-center py-10">
                  <Text className={cn(
                    "text-base",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    No recipes added yet
                  </Text>
                </View>
              )}
              <View className="h-6" />
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Serving Adjustment Modal */}
      <ServingAdjustmentModal
        visible={servingModal.visible}
        recipe={servingModal.recipe}
        currentServingOverride={servingModal.servingOverride}
        onClose={closeServingModal}
        onSave={(servingSize) => {
          if (servingModal.slotId) {
            handleSaveServingSize(servingModal.slotId, servingSize);
          }
        }}
      />
    </View>
  );
}
