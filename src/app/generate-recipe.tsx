import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  X,
  Sparkles,
  Coffee,
  Sun,
  Moon,
  Utensils,
  ChefHat,
  AlertCircle,
  Check,
  RefreshCw,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ShoppingCart,
  Pencil,
  Plus,
  Minus,
  Lock,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import { useMealPlanStore, type Recipe, type Ingredient, type MealSlot, type UserPreferences } from '@/lib/store';
import { useIsAccountPaused } from '@/lib/subscription-store';
import { generateRecipe, generateMealPlan, generateRecipeImage, regenerateSingleRecipe, isOpenAIConfigured, type GeneratedRecipeResponse, type MealType } from '@/lib/openai';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee },
  { key: 'lunch', label: 'Lunch', icon: Sun },
  { key: 'dinner', label: 'Dinner', icon: Moon },
  { key: 'snack', label: 'Snack', icon: Utensils },
] as const;

// Stock images for generated recipes (from Unsplash)
const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
  'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=400',
  'https://images.unsplash.com/photo-1482049016gy-2107e8aa1b16?w=400',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
];

function getRandomStockImage(): string {
  return STOCK_IMAGES[Math.floor(Math.random() * STOCK_IMAGES.length)];
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarDays(year: number, month: number): Array<Date | null> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days: Array<Date | null> = [];

  // Add empty slots for days before the first of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  return days;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function GenerateRecipeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isPaused = useIsAccountPaused();

  const preferences = useMealPlanStore((s) => s.preferences);
  const recipes = useMealPlanStore((s) => s.recipes);
  const addRecipe = useMealPlanStore((s) => s.addRecipe);
  const addMealToSlot = useMealPlanStore((s) => s.addMealToSlot);

  const [selectedMealTypes, setSelectedMealTypes] = useState<Array<'breakfast' | 'lunch' | 'dinner' | 'snack'>>(['dinner']);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipeResponse | null>(null);
  const [generatedMealPlan, setGeneratedMealPlan] = useState<GeneratedRecipeResponse[]>([]);
  const [selectedExistingRecipes, setSelectedExistingRecipes] = useState<string[]>([]);
  const [showRecipePicker, setShowRecipePicker] = useState(false);

  // Calendar state for date range selection
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false); // Track if user is in custom range selection mode
  const [optimizeGrocery, setOptimizeGrocery] = useState(true); // Enabled by default for meal plans

  // Local preferences for this generation session only (doesn't affect saved preferences)
  const [localPreferences, setLocalPreferences] = useState<UserPreferences>(preferences);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [showAllRecipes, setShowAllRecipes] = useState(false);

  const isConfigured = isOpenAIConfigured();

  // Calculate number of days in the selected range
  const numberOfDays = useMemo(() => {
    if (!endDate) return 1;
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [startDate, endDate]);

  const isMealPlan = numberOfDays > 1 || selectedMealTypes.length > 1;

  // Calculate total recipes needed and how many to generate
  const totalRecipesNeeded = useMemo(() => {
    return numberOfDays * selectedMealTypes.length;
  }, [numberOfDays, selectedMealTypes]);

  const recipesToGenerate = useMemo(() => {
    return Math.max(0, totalRecipesNeeded - selectedExistingRecipes.length);
  }, [totalRecipesNeeded, selectedExistingRecipes.length]);

  const calendarDays = useMemo(() => {
    return getCalendarDays(calendarMonth.getFullYear(), calendarMonth.getMonth());
  }, [calendarMonth]);

  const monthYearLabel = useMemo(() => {
    return calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [calendarMonth]);

  const navigateCalendarMonth = useCallback((direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCalendarMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  }, []);

  const toggleMealType = useCallback((mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMealTypes(prev => {
      if (prev.includes(mealType)) {
        // Don't allow deselecting the last item
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== mealType);
      }
      return [...prev, mealType];
    });
  }, []);

  const toggleExistingRecipe = useCallback((recipeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedExistingRecipes(prev => {
      if (prev.includes(recipeId)) {
        return prev.filter(id => id !== recipeId);
      }
      return [...prev, recipeId];
    });
  }, []);

  // Single recipe generation
  const generateMutation = useMutation({
    mutationFn: () =>
      generateRecipe({
        mealTypes: selectedMealTypes,
        preferences: localPreferences,
        additionalInstructions: additionalInstructions.trim() || undefined,
      }),
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGeneratedRecipe(data);
      setGeneratedMealPlan([]);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Generate recipe error:', error);
    },
  });

  // Meal plan generation - simplified: just pass the count and meal types
  const mealPlanMutation = useMutation({
    mutationFn: async (numToGenerate: number) => {
      console.log('=== GENERATING MEAL PLAN ===');
      console.log('Recipes to generate:', numToGenerate);
      console.log('Meal types:', selectedMealTypes);

      // Log session info
      const { data } = await supabase.auth.getSession();
      console.log("SESSION?", !!data.session, data.session?.access_token?.slice(0,10));

      return generateMealPlan({
        mealTypes: selectedMealTypes,
        preferences: localPreferences,
        additionalInstructions: additionalInstructions.trim() || undefined,
        recipesToGenerate: numToGenerate,
        optimizeGrocery: optimizeGrocery,
      });
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGeneratedMealPlan(data);
      setGeneratedRecipe(null);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Generate meal plan error:', error);
    },
  });

  const { mutate: mutateSingle } = generateMutation;
  const { mutate: mutateMealPlan } = mealPlanMutation;
  const isPending = generateMutation.isPending || mealPlanMutation.isPending;
  const isError = generateMutation.isError || mealPlanMutation.isError;
  const error = generateMutation.error || mealPlanMutation.error;

  const handleGenerate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGeneratedRecipe(null);
    setGeneratedMealPlan([]);
    setShowAllRecipes(false);

    console.log('=== GENERATE CLICKED ===');
    console.log('Days:', numberOfDays, 'Meals:', selectedMealTypes.length, 'Total:', recipesToGenerate);

    if (isMealPlan) {
      mutateMealPlan(recipesToGenerate);
    } else {
      mutateSingle();
    }
  }, [isMealPlan, mutateSingle, mutateMealPlan, recipesToGenerate, numberOfDays, selectedMealTypes]);

  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  const handleSaveRecipe = useCallback(async () => {
    if (!generatedRecipe) return;

    setIsSavingRecipe(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let imageUrl = getRandomStockImage();

    // Try to fetch image from Pixabay
    try {
      const pixabayImage = await generateRecipeImage(generatedRecipe.name, generatedRecipe.description);
      if (pixabayImage) {
        imageUrl = pixabayImage;
      }
    } catch (error) {
      console.log('Failed to fetch image from Pixabay, using stock image:', error);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const recipe: Recipe = {
      id: '',
      name: generatedRecipe.name,
      description: generatedRecipe.description,
      imageUrl,
      cookTime: generatedRecipe.cookTime,
      prepTime: generatedRecipe.prepTime,
      servings: generatedRecipe.servings,
      ingredients: generatedRecipe.ingredients.map((ing, index) => ({
        id: `gen-${index}`,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category as Ingredient['category'],
      })),
      instructions: generatedRecipe.instructions,
      tags: generatedRecipe.tags,
      calories: generatedRecipe.calories,
      isAIGenerated: true,
      isSaved: false,
      createdAt: new Date().toISOString(),
    };

    addRecipe(recipe);
    setIsSavingRecipe(false);
    router.back();
  }, [generatedRecipe, addRecipe, router]);

  const [isSavingMealPlan, setIsSavingMealPlan] = useState(false);

  const handleSaveMealPlan = useCallback(async () => {
    if (generatedMealPlan.length === 0 && selectedExistingRecipes.length === 0) return;

    setIsSavingMealPlan(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Combine generated recipes and selected existing recipes
    const numMealTypes = selectedMealTypes.length;

    // Track which day we're on for each meal type
    const mealTypeDayTracker: Record<string, number> = {};
    selectedMealTypes.forEach(mt => {
      mealTypeDayTracker[mt] = 0;
    });

    let totalRecipeIndex = 0;

    // First, add all generated recipes to the meal plan
    for (let idx = 0; idx < generatedMealPlan.length; idx++) {
      const recipeData = generatedMealPlan[idx];

      // Fetch image from Pixabay for each recipe
      let imageUrl = getRandomStockImage();
      try {
        const pixabayImage = await generateRecipeImage(recipeData.name, recipeData.description);
        if (pixabayImage) {
          imageUrl = pixabayImage;
        }
      } catch (error) {
        console.log(`Failed to fetch image for ${recipeData.name}, using stock image:`, error);
      }

      const recipe: Recipe = {
        id: '',
        name: recipeData.name,
        description: recipeData.description,
        imageUrl,
        cookTime: recipeData.cookTime,
        prepTime: recipeData.prepTime,
        servings: recipeData.servings,
        ingredients: recipeData.ingredients.map((ing, index) => ({
          id: `gen-${idx}-${index}`,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          category: ing.category as Ingredient['category'],
        })),
        instructions: recipeData.instructions,
        tags: recipeData.tags,
        calories: recipeData.calories,
        isAIGenerated: true,
        isSaved: false,
        createdAt: new Date().toISOString(),
      };

      const recipeId = addRecipe(recipe);

      // Use the mealType from the recipe if available, otherwise cycle through selected types
      const mealType = (recipeData.mealType && selectedMealTypes.includes(recipeData.mealType))
        ? recipeData.mealType
        : selectedMealTypes[totalRecipeIndex % numMealTypes];

      // Get the day index for this meal type
      const dayIndex = mealTypeDayTracker[mealType] ?? Math.floor(totalRecipeIndex / numMealTypes);

      // Calculate the date for this recipe
      const recipeDate = new Date(startDate);
      recipeDate.setDate(recipeDate.getDate() + dayIndex);
      const dateKey = formatDateKey(recipeDate);

      // Add to meal slot
      const slot: MealSlot = {
        id: '',
        date: dateKey,
        mealType,
        recipeId,
      };
      addMealToSlot(slot);

      // Increment the day tracker for this meal type
      if (mealTypeDayTracker[mealType] !== undefined) {
        mealTypeDayTracker[mealType]++;
      }

      totalRecipeIndex++;
    }

    // Then, add selected existing recipes to the meal plan
    selectedExistingRecipes.forEach((existingRecipeId) => {
      const mealType = selectedMealTypes[totalRecipeIndex % numMealTypes];
      const dayIndex = mealTypeDayTracker[mealType] ?? Math.floor(totalRecipeIndex / numMealTypes);

      const recipeDate = new Date(startDate);
      recipeDate.setDate(recipeDate.getDate() + dayIndex);
      const dateKey = formatDateKey(recipeDate);

      const slot: MealSlot = {
        id: '',
        date: dateKey,
        mealType,
        recipeId: existingRecipeId,
      };
      addMealToSlot(slot);

      if (mealTypeDayTracker[mealType] !== undefined) {
        mealTypeDayTracker[mealType]++;
      }

      totalRecipeIndex++;
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSavingMealPlan(false);
    router.back();
  }, [generatedMealPlan, selectedExistingRecipes, addRecipe, addMealToSlot, router, startDate, selectedMealTypes]);

  const handleRegenerate = useCallback(() => {
    setGeneratedRecipe(null);
    setGeneratedMealPlan([]);
    setShowAllRecipes(false);
    handleGenerate();
  }, [handleGenerate]);

  // Regenerate a single recipe in the meal plan
  const handleRegenerateSingle = useCallback(async (index: number) => {
    if (regeneratingIndex !== null) return; // Already regenerating

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRegeneratingIndex(index);

    const recipeToReplace = generatedMealPlan[index];
    const mealType = recipeToReplace?.mealType ?? selectedMealTypes[index % selectedMealTypes.length];

    // Get all other recipe names to exclude
    const excludeNames = generatedMealPlan
      .filter((_, i) => i !== index)
      .map(r => r.name);

    try {
      const newRecipe = await regenerateSingleRecipe(
        {
          mealTypes: [mealType],
          preferences: localPreferences,
          additionalInstructions: additionalInstructions.trim() || undefined,
        },
        excludeNames
      );

      // Update the meal plan with the new recipe
      setGeneratedMealPlan(prev => {
        const updated = [...prev];
        updated[index] = newRecipe;
        return updated;
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to regenerate single recipe:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRegeneratingIndex(null);
    }
  }, [regeneratingIndex, generatedMealPlan, selectedMealTypes, localPreferences, additionalInstructions]);

  return (
    <View className={cn("flex-1", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
      <LinearGradient
        colors={isDark ? ['#773323', '#262626'] : ['#fceae3', '#fefdfb']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          className="flex-row items-center justify-between px-5 py-4"
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className={cn(
              "w-10 h-10 rounded-full items-center justify-center",
              isDark ? "bg-charcoal-800/50" : "bg-white/80"
            )}
          >
            <X size={20} color={isDark ? '#fff' : '#262626'} />
          </Pressable>
          <View className="flex-row items-center">
            <Sparkles size={20} color={isDark ? '#f5b8a0' : '#e46d46'} />
            <Text className={cn(
              "text-lg font-bold ml-2",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              AI Recipe Generator
            </Text>
          </View>
          <View className="w-10" />
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* API Not Configured Warning */}
          {!isConfigured && (
            <Animated.View
              entering={FadeInDown.delay(150).springify()}
              className="px-5 mb-4"
            >
              <View className={cn(
                "flex-row items-center p-4 rounded-2xl",
                isDark ? "bg-terracotta-900/30" : "bg-terracotta-50"
              )}>
                <AlertCircle size={20} color={isDark ? '#f5b8a0' : '#e46d46'} />
                <View className="flex-1 ml-3">
                  <Text className={cn(
                    "text-sm font-semibold",
                    isDark ? "text-terracotta-300" : "text-terracotta-700"
                  )}>
                    API Key Required
                  </Text>
                  <Text className={cn(
                    "text-sm mt-1",
                    isDark ? "text-terracotta-400" : "text-terracotta-600"
                  )}>
                    Supabase must be configured for AI features to work
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Account Paused Warning */}
          {isPaused && (
            <Animated.View
              entering={FadeInDown.delay(150).springify()}
              className="px-5 mb-4"
            >
              <View className={cn(
                "flex-row items-center p-4 rounded-2xl",
                isDark ? "bg-amber-900/30" : "bg-amber-50"
              )}>
                <Lock size={20} color={isDark ? '#fbbf24' : '#d97706'} />
                <View className="flex-1 ml-3">
                  <Text className={cn(
                    "text-sm font-semibold",
                    isDark ? "text-amber-400" : "text-amber-700"
                  )}>
                    Account Paused
                  </Text>
                  <Text className={cn(
                    "text-sm mt-1",
                    isDark ? "text-amber-500" : "text-amber-600"
                  )}>
                    AI recipe generation is unavailable while your account is paused. Go to Settings to resume.
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Meal Plan Duration */}
          <Animated.View
            entering={FadeInDown.delay(175).springify()}
            className="px-5 mb-6"
          >
            <View className="flex-row items-center mb-3">
              <CalendarDays size={18} color={isDark ? '#a6b594' : '#6a7d56'} />
              <Text className={cn(
                "text-base font-semibold ml-2",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Meal Plan Duration
              </Text>
            </View>

            {/* Duration Options - Single Row */}
            <View className="flex-row">
              {[
                { label: 'Single', days: 1 },
                { label: '3 Days', days: 3 },
                { label: '1 Week', days: 7 },
                { label: 'Custom', days: 0 },
              ].map((option, index) => {
                const isCustom = option.days === 0;
                const isSelected = isCustom
                  ? showCalendar && ![1, 3, 7].includes(numberOfDays)
                  : numberOfDays === option.days;

                return (
                  <Pressable
                    key={option.label}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                      if (isCustom) {
                        // Custom button - prepare for range selection and toggle calendar
                        if (!showCalendar) {
                          // Opening calendar for custom range - initialize for range selection
                          setIsCustomMode(true);
                          // If currently in single day mode, set up for range selection
                          if (!endDate) {
                            // Create a default end date (start + 1 day) for range selection
                            const defaultEnd = new Date(startDate);
                            defaultEnd.setDate(defaultEnd.getDate() + 1);
                            setEndDate(defaultEnd);
                          }
                        } else {
                          // Closing custom calendar
                          setIsCustomMode(false);
                        }
                        setShowCalendar(!showCalendar);
                      } else {
                        // For preset options (Single, 3 Days, 1 Week)
                        setIsCustomMode(false);
                        const newStartDate = new Date(startDate);
                        newStartDate.setHours(0, 0, 0, 0);

                        if (option.days === 1) {
                          setEndDate(null);
                        } else {
                          const end = new Date(newStartDate);
                          end.setDate(end.getDate() + option.days - 1);
                          setEndDate(end);
                        }

                        // Toggle calendar if already selected, otherwise open it
                        if (isSelected && showCalendar) {
                          setShowCalendar(false);
                        } else {
                          setShowCalendar(true);
                        }
                      }
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-2xl items-center",
                      index < 3 && "mr-2",
                      isSelected
                        ? isDark ? "bg-sage-600" : "bg-sage-500"
                        : isDark ? "bg-charcoal-800" : "bg-white"
                    )}
                  >
                    <Text className={cn(
                      "text-sm font-medium",
                      isSelected
                        ? "text-white"
                        : isDark ? "text-charcoal-300" : "text-charcoal-600"
                    )}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Calendar (shown when 3 Days, 1 Week, or Custom is selected) */}
            {showCalendar && (
              <View className={cn(
                "rounded-2xl p-4 mt-4",
                isDark ? "bg-charcoal-800" : "bg-white"
              )}>
                {/* Selected Range Display */}
                <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-charcoal-700/30">
                  <View className="flex-1">
                    <Text className={cn(
                      "text-xs uppercase tracking-wide mb-1",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Start
                    </Text>
                    <Text className={cn(
                      "text-base font-semibold",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View className={cn(
                    "w-8 h-0.5 mx-3",
                    isDark ? "bg-charcoal-600" : "bg-cream-300"
                  )} />
                  <View className="flex-1 items-end">
                    <Text className={cn(
                      "text-xs uppercase tracking-wide mb-1",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      End
                    </Text>
                    <Text className={cn(
                      "text-base font-semibold",
                      endDate ? (isDark ? "text-white" : "text-charcoal-900") : (isDark ? "text-charcoal-500" : "text-charcoal-400")
                    )}>
                      {endDate ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Select'}
                    </Text>
                  </View>
                </View>

                {/* Month Navigation */}
                <View className="flex-row items-center justify-between mb-4">
                  <Pressable
                    onPress={() => navigateCalendarMonth('prev')}
                    className="p-2"
                  >
                    <ChevronLeft size={20} color={isDark ? '#fff' : '#262626'} />
                  </Pressable>
                  <Text className={cn(
                    "text-base font-semibold",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    {monthYearLabel}
                  </Text>
                  <Pressable
                    onPress={() => navigateCalendarMonth('next')}
                    className="p-2"
                  >
                    <ChevronRight size={20} color={isDark ? '#fff' : '#262626'} />
                  </Pressable>
                </View>

                {/* Weekday Headers */}
                <View className="flex-row mb-2">
                  {WEEKDAYS.map((day, index) => (
                    <View key={index} className="w-[14.28%] items-center">
                      <Text className={cn(
                        "text-xs font-medium",
                        isDark ? "text-charcoal-500" : "text-charcoal-400"
                      )}>
                        {day}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Calendar Days */}
                <View className="flex-row flex-wrap">
                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <View key={`empty-${index}`} className="w-[14.28%] h-10" />;
                    }

                    const dayKey = formatDateKey(day);
                    const startKey = formatDateKey(startDate);
                    const endKey = endDate ? formatDateKey(endDate) : null;

                    const isStart = dayKey === startKey;
                    const isEnd = endKey && dayKey === endKey;
                    const isInRange = endDate && day >= startDate && day <= endDate;
                    const isToday = dayKey === formatDateKey(new Date());
                    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

                    return (
                      <Pressable
                        key={dayKey}
                        onPress={() => {
                          if (isPast) return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                          // Single day preset mode - just set the selected day
                          if (!isCustomMode && !endDate) {
                            setStartDate(day);
                            return;
                          }

                          if (!endDate) {
                            // No end date yet - first tap sets start, second tap sets end
                            if (dayKey === startKey) {
                              // Tapping current start date - do nothing
                              return;
                            } else if (day > startDate) {
                              // Tapped a date after start - set as end date
                              setEndDate(day);
                            } else {
                              // Tapped a date before start - set as new start date
                              setStartDate(day);
                            }
                          } else {
                            // End date exists - tap anywhere to start fresh selection
                            if (dayKey === startKey) {
                              // Tapping start date - clear end date
                              setEndDate(null);
                            } else if (dayKey === endKey) {
                              // Tapping end date - clear it
                              setEndDate(null);
                            } else {
                              // Tapping any other date - set as new start, clear end
                              setStartDate(day);
                              setEndDate(null);
                            }
                          }
                        }}
                        disabled={isPast}
                        className="w-[14.28%] h-10 items-center justify-center"
                      >
                        <View className={cn(
                          "w-9 h-9 rounded-full items-center justify-center",
                          (isStart || isEnd) && (isDark ? "bg-sage-600" : "bg-sage-500"),
                          isInRange && !isStart && !isEnd && (isDark ? "bg-sage-900/50" : "bg-sage-100"),
                          isToday && !isStart && !isEnd && !isInRange && "border-2 border-sage-400"
                        )}>
                          <Text className={cn(
                            "text-sm",
                            (isStart || isEnd)
                              ? "text-white font-semibold"
                              : isPast
                                ? isDark ? "text-charcoal-700" : "text-charcoal-300"
                                : isInRange
                                  ? isDark ? "text-sage-300" : "text-sage-700"
                                  : isDark ? "text-white" : "text-charcoal-900"
                          )}>
                            {day.getDate()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {numberOfDays > 1 && (
                  <View className={cn(
                    "mt-4 pt-4 border-t border-charcoal-700/30"
                  )}>
                    <Text className={cn(
                      "text-sm text-center font-medium",
                      isDark ? "text-sage-400" : "text-sage-600"
                    )}>
                      {numberOfDays} days • {totalRecipesNeeded} recipes
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          {/* Meal Type Selector */}
          <Animated.View
            entering={FadeInDown.delay(225).springify()}
            className="px-5 mb-6"
          >
            <Text className={cn(
              "text-base font-semibold mb-3",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              What meals are you planning?
            </Text>
            <View className="flex-row">
              {MEAL_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedMealTypes.includes(type.key);

                return (
                  <Pressable
                    key={type.key}
                    onPress={() => toggleMealType(type.key)}
                    className={cn(
                      "flex-1 items-center py-4 rounded-2xl mr-2",
                      isSelected
                        ? isDark ? "bg-terracotta-600" : "bg-terracotta-500"
                        : isDark ? "bg-charcoal-800" : "bg-white"
                    )}
                  >
                    <Icon
                      size={24}
                      color={isSelected ? '#fff' : isDark ? '#888888' : '#6d6d6d'}
                    />
                    <Text className={cn(
                      "text-sm font-medium mt-2",
                      isSelected
                        ? "text-white"
                        : isDark ? "text-charcoal-300" : "text-charcoal-600"
                    )}>
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Add from Existing Recipes */}
          <Animated.View
            entering={FadeInDown.delay(240).springify()}
            className="mb-6"
          >
            <View className="flex-row items-center justify-between px-5 mb-3">
              <View className="flex-row items-center">
                <BookOpen size={18} color={isDark ? '#a6b594' : '#6a7d56'} />
                <Text className={cn(
                  "text-base font-semibold ml-2",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Add from Your Recipes
                </Text>
              </View>
              <Pressable onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowRecipePicker(true);
              }}>
                <Text className={cn(
                  "text-sm font-medium",
                  isDark ? "text-sage-400" : "text-sage-600"
                )}>
                  See all
                </Text>
              </Pressable>
            </View>

            {recipes.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                style={{ flexGrow: 0 }}
              >
                {recipes.map((recipe) => {
                  const isSelected = selectedExistingRecipes.includes(recipe.id);
                  return (
                    <Pressable
                      key={recipe.id}
                      onPress={() => toggleExistingRecipe(recipe.id)}
                      className={cn(
                        "mr-4 rounded-2xl overflow-hidden",
                        isDark ? "bg-charcoal-800" : "bg-white",
                        isSelected && (isDark ? "border-2 border-sage-500" : "border-2 border-sage-400")
                      )}
                      style={{ width: 160 }}
                    >
                      <View className="relative">
                        <Image
                          source={{ uri: recipe.imageUrl }}
                          className="w-full h-24"
                        />
                        {isSelected && (
                          <View className={cn(
                            "absolute top-2 right-2 w-6 h-6 rounded-full items-center justify-center",
                            isDark ? "bg-sage-600" : "bg-sage-500"
                          )}>
                            <Check size={14} color="#fff" />
                          </View>
                        )}
                      </View>
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
                          {recipe.cookTime + recipe.prepTime} min • {recipe.calories ?? 0} cal
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View className={cn(
                "mx-5 rounded-2xl p-4 items-center",
                isDark ? "bg-charcoal-800/50" : "bg-cream-100"
              )}>
                <Text className={cn(
                  "text-sm text-center",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  No recipes yet. Generate some recipes first!
                </Text>
              </View>
            )}

            {selectedExistingRecipes.length > 0 && (
              <View className="px-5 mt-3">
                <View className={cn(
                  "flex-row items-center px-3 py-2 rounded-xl",
                  isDark ? "bg-sage-900/30" : "bg-sage-50"
                )}>
                  <Check size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                  <Text className={cn(
                    "text-sm font-medium ml-2",
                    isDark ? "text-sage-300" : "text-sage-700"
                  )}>
                    {selectedExistingRecipes.length} of {totalRecipesNeeded} recipes selected
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Additional Instructions */}
          <Animated.View
            entering={FadeInDown.delay(250).springify()}
            className="px-5 mb-6"
          >
            <Text className={cn(
              "text-base font-semibold mb-3",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              Any special requests?
            </Text>
            <TextInput
              value={additionalInstructions}
              onChangeText={setAdditionalInstructions}
              placeholder="e.g., Use chicken, under 500 calories, kid-friendly..."
              placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
              multiline
              numberOfLines={3}
              className={cn(
                "px-4 py-3 rounded-2xl text-base",
                isDark ? "bg-charcoal-800 text-white" : "bg-white text-charcoal-900"
              )}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </Animated.View>

          {/* Your Preferences Summary */}
          <Animated.View
            entering={FadeInDown.delay(300).springify()}
            className="px-5 mb-6"
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPreferencesModal(true);
              }}
              className={cn(
                "rounded-2xl p-4",
                isDark ? "bg-charcoal-800/50" : "bg-sage-50"
              )}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <ChefHat size={18} color={isDark ? '#a6b594' : '#6a7d56'} />
                  <Text className={cn(
                    "text-sm font-semibold ml-2",
                    isDark ? "text-sage-300" : "text-sage-700"
                  )}>
                    Based on Your Preferences
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Pencil size={14} color={isDark ? '#a6b594' : '#6a7d56'} />
                  <Text className={cn(
                    "text-xs font-medium ml-1",
                    isDark ? "text-sage-400" : "text-sage-600"
                  )}>
                    Edit
                  </Text>
                </View>
              </View>
              <View className="flex-row flex-wrap">
                <View className={cn(
                  "px-2.5 py-1 rounded-full mr-2 mb-2",
                  isDark ? "bg-charcoal-700" : "bg-white"
                )}>
                  <Text className={cn(
                    "text-xs",
                    isDark ? "text-charcoal-300" : "text-charcoal-600"
                  )}>
                    {localPreferences.servingSize} servings
                  </Text>
                </View>
                <View className={cn(
                  "px-2.5 py-1 rounded-full mr-2 mb-2",
                  isDark ? "bg-charcoal-700" : "bg-white"
                )}>
                  <Text className={cn(
                    "text-xs capitalize",
                    isDark ? "text-charcoal-300" : "text-charcoal-600"
                  )}>
                    {localPreferences.cookingSkillLevel} level
                  </Text>
                </View>
                <View className={cn(
                  "px-2.5 py-1 rounded-full mr-2 mb-2",
                  isDark ? "bg-charcoal-700" : "bg-white"
                )}>
                  <Text className={cn(
                    "text-xs capitalize",
                    isDark ? "text-charcoal-300" : "text-charcoal-600"
                  )}>
                    {localPreferences.mealPrepTime} prep
                  </Text>
                </View>
                {localPreferences.dietaryRestrictions.slice(0, 2).map((diet) => (
                  <View
                    key={diet}
                    className={cn(
                      "px-2.5 py-1 rounded-full mr-2 mb-2",
                      isDark ? "bg-charcoal-700" : "bg-white"
                    )}
                  >
                    <Text className={cn(
                      "text-xs",
                      isDark ? "text-charcoal-300" : "text-charcoal-600"
                    )}>
                      {diet}
                    </Text>
                  </View>
                ))}
                {localPreferences.cuisinePreferences.slice(0, 2).map((cuisine) => (
                  <View
                    key={cuisine}
                    className={cn(
                      "px-2.5 py-1 rounded-full mr-2 mb-2",
                      isDark ? "bg-charcoal-700" : "bg-white"
                    )}
                  >
                    <Text className={cn(
                      "text-xs",
                      isDark ? "text-charcoal-300" : "text-charcoal-600"
                    )}>
                      {cuisine}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          </Animated.View>

          {/* Grocery Optimization Toggle - Only show for meal plans */}
          {isMealPlan && (
            <Animated.View
              entering={FadeInDown.delay(310).springify()}
              className="px-5 mb-6"
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setOptimizeGrocery(!optimizeGrocery);
                }}
                className={cn(
                  "flex-row items-center p-4 rounded-2xl",
                  optimizeGrocery
                    ? isDark ? "bg-sage-900/50 border-2 border-sage-600" : "bg-sage-50 border-2 border-sage-400"
                    : isDark ? "bg-charcoal-800" : "bg-white"
                )}
              >
                <View className={cn(
                  "w-10 h-10 rounded-xl items-center justify-center mr-3",
                  optimizeGrocery
                    ? isDark ? "bg-sage-700" : "bg-sage-200"
                    : isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}>
                  <ShoppingCart
                    size={20}
                    color={optimizeGrocery
                      ? isDark ? '#a6b594' : '#6a7d56'
                      : isDark ? '#888888' : '#6d6d6d'
                    }
                  />
                </View>
                <View className="flex-1 mr-3">
                  <Text className={cn(
                    "text-base font-semibold",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    Optimize Grocery Shopping
                  </Text>
                  <Text className={cn(
                    "text-sm mt-0.5",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    Use shared ingredients across recipes to reduce waste and save money
                  </Text>
                </View>
                <View className={cn(
                  "w-6 h-6 rounded-full items-center justify-center",
                  optimizeGrocery
                    ? isDark ? "bg-sage-600" : "bg-sage-500"
                    : isDark ? "bg-charcoal-700" : "bg-cream-200"
                )}>
                  {optimizeGrocery && <Check size={14} color="#fff" />}
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Generated Recipe Preview */}
          {generatedRecipe && (
            <Animated.View
              entering={FadeInUp.springify()}
              className="px-5 mb-6"
            >
              <View className={cn(
                "rounded-2xl p-5",
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
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Sparkles size={18} color={isDark ? '#f5b8a0' : '#e46d46'} />
                    <Text className={cn(
                      "text-sm font-medium ml-2",
                      isDark ? "text-terracotta-300" : "text-terracotta-600"
                    )}>
                      AI Generated Recipe
                    </Text>
                  </View>
                  {/* Meal Type Badge for Single Recipe */}
                  {selectedMealTypes[0] && (
                    <View className={cn(
                      "flex-row items-center px-2.5 py-1 rounded-full",
                      selectedMealTypes[0] === 'breakfast' && (isDark ? "bg-amber-900/40" : "bg-amber-100"),
                      selectedMealTypes[0] === 'lunch' && (isDark ? "bg-orange-900/40" : "bg-orange-100"),
                      selectedMealTypes[0] === 'dinner' && (isDark ? "bg-indigo-900/40" : "bg-indigo-100"),
                      selectedMealTypes[0] === 'snack' && (isDark ? "bg-emerald-900/40" : "bg-emerald-100")
                    )}>
                      {(() => {
                        const MealIcon = MEAL_TYPES.find(mt => mt.key === selectedMealTypes[0])?.icon ?? Utensils;
                        return (
                          <MealIcon
                            size={12}
                            color={
                              selectedMealTypes[0] === 'breakfast' ? (isDark ? '#fbbf24' : '#d97706') :
                              selectedMealTypes[0] === 'lunch' ? (isDark ? '#fb923c' : '#ea580c') :
                              selectedMealTypes[0] === 'dinner' ? (isDark ? '#a5b4fc' : '#4f46e5') :
                              selectedMealTypes[0] === 'snack' ? (isDark ? '#6ee7b7' : '#059669') :
                              (isDark ? '#888888' : '#6d6d6d')
                            }
                          />
                        );
                      })()}
                      <Text className={cn(
                        "text-xs font-semibold ml-1 uppercase",
                        selectedMealTypes[0] === 'breakfast' && (isDark ? "text-amber-400" : "text-amber-700"),
                        selectedMealTypes[0] === 'lunch' && (isDark ? "text-orange-400" : "text-orange-700"),
                        selectedMealTypes[0] === 'dinner' && (isDark ? "text-indigo-400" : "text-indigo-700"),
                        selectedMealTypes[0] === 'snack' && (isDark ? "text-emerald-400" : "text-emerald-700")
                      )}>
                        {MEAL_TYPES.find(mt => mt.key === selectedMealTypes[0])?.label ?? 'Meal'}
                      </Text>
                    </View>
                  )}
                </View>

                <Text className={cn(
                  "text-xl font-bold",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  {generatedRecipe.name}
                </Text>
                <Text className={cn(
                  "text-sm mt-2",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  {generatedRecipe.description}
                </Text>

                <View className="flex-row mt-4 space-x-4">
                  <View className="flex-row items-center">
                    <Text className={cn(
                      "text-sm",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      {generatedRecipe.prepTime + generatedRecipe.cookTime} min
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className={cn(
                      "text-sm",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      {generatedRecipe.calories} cal
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className={cn(
                      "text-sm",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      {generatedRecipe.servings} servings
                    </Text>
                  </View>
                </View>

                <View className="flex-row flex-wrap mt-3">
                  {generatedRecipe.tags.slice(0, 4).map((tag) => (
                    <View
                      key={tag}
                      className={cn(
                        "px-2.5 py-1 rounded-full mr-2 mb-1",
                        isDark ? "bg-charcoal-700" : "bg-cream-100"
                      )}
                    >
                      <Text className={cn(
                        "text-xs capitalize",
                        isDark ? "text-charcoal-300" : "text-charcoal-600"
                      )}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>

                <View className={cn(
                  "mt-4 pt-4",
                  isDark ? "border-t border-charcoal-700" : "border-t border-cream-200"
                )}>
                  <Text className={cn(
                    "text-sm font-semibold mb-2",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    Ingredients ({generatedRecipe.ingredients.length})
                  </Text>
                  {generatedRecipe.ingredients.slice(0, 5).map((ing, i) => (
                    <Text
                      key={i}
                      className={cn(
                        "text-sm",
                        isDark ? "text-charcoal-400" : "text-charcoal-500"
                      )}
                    >
                      • {ing.quantity} {ing.unit} {ing.name}
                    </Text>
                  ))}
                  {generatedRecipe.ingredients.length > 5 && (
                    <Text className={cn(
                      "text-sm italic",
                      isDark ? "text-charcoal-500" : "text-charcoal-400"
                    )}>
                      +{generatedRecipe.ingredients.length - 5} more...
                    </Text>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Generated Meal Plan Preview */}
          {generatedMealPlan.length > 0 && (
            <Animated.View
              entering={FadeInUp.springify()}
              className="px-5 mb-6"
            >
              <View className={cn(
                "rounded-2xl p-5",
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
                <View className="flex-row items-center mb-3">
                  <CalendarDays size={18} color={isDark ? '#a6b594' : '#6a7d56'} />
                  <Text className={cn(
                    "text-sm font-medium ml-2",
                    isDark ? "text-sage-300" : "text-sage-600"
                  )}>
                    AI Generated Meal Plan ({generatedMealPlan.length} recipes)
                  </Text>
                </View>

                {(() => {
                  // Sort recipes by meal type order: breakfast, lunch, dinner, snack
                  const mealTypeOrder: Record<string, number> = {
                    breakfast: 0,
                    lunch: 1,
                    dinner: 2,
                    snack: 3,
                  };

                  const sortedRecipes = [...generatedMealPlan].sort((a, b) => {
                    const orderA = mealTypeOrder[a.mealType ?? 'dinner'] ?? 2;
                    const orderB = mealTypeOrder[b.mealType ?? 'dinner'] ?? 2;
                    return orderA - orderB;
                  });

                  // Create a mapping to find original index for regeneration
                  const getOriginalIndex = (recipe: GeneratedRecipeResponse) =>
                    generatedMealPlan.findIndex(r => r.name === recipe.name);

                  return (showAllRecipes ? sortedRecipes : sortedRecipes.slice(0, 5)).map((recipe, displayIndex) => {
                    const originalIndex = getOriginalIndex(recipe);
                    const MealIcon = MEAL_TYPES.find(mt => mt.key === recipe.mealType)?.icon ?? Utensils;
                    const mealLabel = MEAL_TYPES.find(mt => mt.key === recipe.mealType)?.label ?? 'Meal';

                    return (
                      <View
                        key={originalIndex}
                        className={cn(
                          "py-3",
                          displayIndex > 0 && (isDark ? "border-t border-charcoal-700" : "border-t border-cream-200")
                        )}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1 mr-3">
                            {/* Meal Type Badge */}
                            <View className="flex-row items-center mb-1">
                              <View className={cn(
                                "flex-row items-center px-2 py-0.5 rounded-full",
                                recipe.mealType === 'breakfast' && (isDark ? "bg-amber-900/40" : "bg-amber-100"),
                                recipe.mealType === 'lunch' && (isDark ? "bg-orange-900/40" : "bg-orange-100"),
                                recipe.mealType === 'dinner' && (isDark ? "bg-indigo-900/40" : "bg-indigo-100"),
                                recipe.mealType === 'snack' && (isDark ? "bg-emerald-900/40" : "bg-emerald-100"),
                                !recipe.mealType && (isDark ? "bg-charcoal-700" : "bg-cream-100")
                              )}>
                                <MealIcon
                                  size={10}
                                  color={
                                    recipe.mealType === 'breakfast' ? (isDark ? '#fbbf24' : '#d97706') :
                                    recipe.mealType === 'lunch' ? (isDark ? '#fb923c' : '#ea580c') :
                                    recipe.mealType === 'dinner' ? (isDark ? '#a5b4fc' : '#4f46e5') :
                                    recipe.mealType === 'snack' ? (isDark ? '#6ee7b7' : '#059669') :
                                    (isDark ? '#888888' : '#6d6d6d')
                                  }
                                />
                                <Text className={cn(
                                  "text-[10px] font-semibold ml-1 uppercase tracking-wide",
                                  recipe.mealType === 'breakfast' && (isDark ? "text-amber-400" : "text-amber-700"),
                                  recipe.mealType === 'lunch' && (isDark ? "text-orange-400" : "text-orange-700"),
                                  recipe.mealType === 'dinner' && (isDark ? "text-indigo-400" : "text-indigo-700"),
                                  recipe.mealType === 'snack' && (isDark ? "text-emerald-400" : "text-emerald-700"),
                                  !recipe.mealType && (isDark ? "text-charcoal-400" : "text-charcoal-500")
                                )}>
                                  {mealLabel}
                                </Text>
                              </View>
                            </View>
                            <Text className={cn(
                              "text-base font-semibold",
                              isDark ? "text-white" : "text-charcoal-900"
                            )}>
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
                          </View>
                          <View className="flex-row items-center">
                            <View className="items-end mr-3">
                              <Text className={cn(
                                "text-xs",
                                isDark ? "text-charcoal-500" : "text-charcoal-400"
                              )}>
                                {recipe.prepTime + recipe.cookTime} min
                              </Text>
                              <Text className={cn(
                                "text-xs",
                                isDark ? "text-charcoal-500" : "text-charcoal-400"
                              )}>
                                {recipe.calories} cal
                              </Text>
                            </View>
                            {/* Regenerate single recipe button */}
                            <Pressable
                              onPress={() => handleRegenerateSingle(originalIndex)}
                              disabled={regeneratingIndex !== null}
                              className={cn(
                                "w-8 h-8 rounded-full items-center justify-center",
                                isDark ? "bg-charcoal-700" : "bg-cream-100"
                              )}
                            >
                              {regeneratingIndex === originalIndex ? (
                                <ActivityIndicator size="small" color={isDark ? '#888888' : '#6d6d6d'} />
                              ) : (
                                <RefreshCw
                                  size={14}
                                  color={isDark ? '#888888' : '#6d6d6d'}
                                />
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  });
                })()}

                {generatedMealPlan.length > 5 && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowAllRecipes(!showAllRecipes);
                    }}
                    className={cn(
                      "mt-3 py-2 rounded-xl items-center",
                      isDark ? "bg-charcoal-700" : "bg-cream-100"
                    )}
                  >
                    <Text className={cn(
                      "text-sm font-medium",
                      isDark ? "text-sage-400" : "text-sage-600"
                    )}>
                      {showAllRecipes
                        ? 'Show less'
                        : `Show ${generatedMealPlan.length - 5} more recipes`}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Error State */}
          {isError && (
            <Animated.View
              entering={FadeInUp.springify()}
              className="px-5 mb-6"
            >
              <View className={cn(
                "flex-row items-center p-4 rounded-2xl",
                isDark ? "bg-red-900/30" : "bg-red-50"
              )}>
                <AlertCircle size={20} color="#dc2626" />
                <Text className={cn(
                  "flex-1 text-sm ml-3",
                  isDark ? "text-red-300" : "text-red-700"
                )}>
                  {error?.message || 'Failed to generate recipe. Please try again.'}
                </Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Bottom Action */}
        <View className={cn(
          "absolute bottom-0 left-0 right-0 px-5 pb-10 pt-4",
          isDark ? "bg-charcoal-900" : "bg-cream-50"
        )}>
          <LinearGradient
            colors={isDark ? ['transparent', '#262626'] : ['transparent', '#fefdfb']}
            style={{
              position: 'absolute',
              top: -40,
              left: 0,
              right: 0,
              height: 40,
            }}
          />

          {generatedRecipe ? (
            <View className="flex-row space-x-3">
              <Pressable
                onPress={handleRegenerate}
                disabled={isPending || isSavingRecipe}
                className={cn(
                  "flex-row items-center justify-center py-4 px-6 rounded-2xl",
                  isDark ? "bg-charcoal-800" : "bg-cream-200"
                )}
              >
                <RefreshCw
                  size={18}
                  color={isDark ? '#888888' : '#6d6d6d'}
                />
              </Pressable>
              <Pressable
                onPress={handleSaveRecipe}
                disabled={isSavingRecipe}
                className={cn(
                  "flex-1 flex-row items-center justify-center py-4 rounded-2xl",
                  isDark ? "bg-sage-600" : "bg-sage-500"
                )}
              >
                {isSavingRecipe ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text className="text-white text-base font-semibold ml-2">
                      Generating Image...
                    </Text>
                  </>
                ) : (
                  <>
                    <Check size={20} color="#fff" />
                    <Text className="text-white text-base font-semibold ml-2">
                      Save Recipe
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : generatedMealPlan.length > 0 ? (
            <View className="flex-row space-x-3">
              <Pressable
                onPress={handleRegenerate}
                disabled={isPending || isSavingMealPlan}
                className={cn(
                  "flex-row items-center justify-center py-4 px-6 rounded-2xl",
                  isDark ? "bg-charcoal-800" : "bg-cream-200"
                )}
              >
                <RefreshCw
                  size={18}
                  color={isDark ? '#888888' : '#6d6d6d'}
                />
              </Pressable>
              <Pressable
                onPress={handleSaveMealPlan}
                disabled={isSavingMealPlan}
                className={cn(
                  "flex-1 flex-row items-center justify-center py-4 rounded-2xl",
                  isDark ? "bg-sage-600" : "bg-sage-500"
                )}
              >
                {isSavingMealPlan ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text className="text-white text-base font-semibold ml-2">
                      Generating Images...
                    </Text>
                  </>
                ) : (
                  <>
                    <Check size={20} color="#fff" />
                    <Text className="text-white text-base font-semibold ml-2">
                      Save {generatedMealPlan.length + selectedExistingRecipes.length} Recipes
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : isMealPlan && selectedExistingRecipes.length > 0 && recipesToGenerate === 0 ? (
            // All recipes selected from existing, no need to generate
            <Pressable
              onPress={handleSaveMealPlan}
              className={cn(
                "flex-row items-center justify-center py-4 rounded-2xl",
                isDark ? "bg-sage-600" : "bg-sage-500"
              )}
            >
              <Check size={20} color="#fff" />
              <Text className="text-white text-base font-semibold ml-2">
                Save {selectedExistingRecipes.length} Recipes
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleGenerate}
              disabled={!isConfigured || isPending || isPaused || (isMealPlan && recipesToGenerate === 0)}
              className={cn(
                "flex-row items-center justify-center py-4 rounded-2xl",
                isPaused
                  ? isDark ? "bg-amber-900/30" : "bg-amber-100"
                  : isConfigured && !isPending && (isMealPlan ? recipesToGenerate > 0 : true)
                    ? isDark ? "bg-terracotta-600" : "bg-terracotta-500"
                    : isDark ? "bg-charcoal-800" : "bg-cream-200"
              )}
            >
              {isPending ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text className="text-white text-base font-semibold ml-2">
                    {isMealPlan ? `Generating ${recipesToGenerate} Recipes...` : 'Generating...'}
                  </Text>
                </>
              ) : isPaused ? (
                <>
                  <Lock size={20} color={isDark ? '#fbbf24' : '#d97706'} />
                  <Text className={cn(
                    "text-base font-semibold ml-2",
                    isDark ? "text-amber-400" : "text-amber-700"
                  )}>
                    Account Paused
                  </Text>
                </>
              ) : (
                <>
                  {isMealPlan ? (
                    <CalendarDays size={20} color={isConfigured && recipesToGenerate > 0 ? '#fff' : isDark ? '#6d6d6d' : '#888888'} />
                  ) : (
                    <Sparkles size={20} color={isConfigured ? '#fff' : isDark ? '#6d6d6d' : '#888888'} />
                  )}
                  <Text className={cn(
                    "text-base font-semibold ml-2",
                    isConfigured && (isMealPlan ? recipesToGenerate > 0 : true)
                      ? "text-white"
                      : isDark ? "text-charcoal-600" : "text-charcoal-400"
                  )}>
                    {isMealPlan
                      ? selectedExistingRecipes.length > 0
                        ? `Generate ${recipesToGenerate} More Recipes`
                        : `Generate ${totalRecipesNeeded} Recipes`
                      : 'Generate Recipe'}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {/* Recipe Picker Modal */}
      <Modal
        visible={showRecipePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecipePicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className={cn(
              "rounded-t-3xl max-h-[80%]",
              isDark ? "bg-charcoal-900" : "bg-white"
            )}
          >
            {/* Modal Header */}
            <View className={cn(
              "flex-row items-center justify-between px-5 py-4 border-b",
              isDark ? "border-charcoal-800" : "border-cream-200"
            )}>
              <Pressable
                onPress={() => setShowRecipePicker(false)}
                className="w-10"
              >
                <X size={24} color={isDark ? '#fff' : '#262626'} />
              </Pressable>
              <Text className={cn(
                "text-lg font-semibold",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Select Recipes
              </Text>
              <Pressable
                onPress={() => setShowRecipePicker(false)}
                className="w-10 items-end"
              >
                <Text className={cn(
                  "text-base font-semibold",
                  isDark ? "text-sage-400" : "text-sage-600"
                )}>
                  Done
                </Text>
              </Pressable>
            </View>

            {/* Recipe List */}
            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
            >
              {recipes.length > 0 ? (
                recipes.map((recipe) => {
                  const isSelected = selectedExistingRecipes.includes(recipe.id);
                  return (
                    <Pressable
                      key={recipe.id}
                      onPress={() => toggleExistingRecipe(recipe.id)}
                      className={cn(
                        "flex-row items-center p-4 rounded-2xl mb-3",
                        isSelected
                          ? isDark ? "bg-sage-900/50 border-2 border-sage-600" : "bg-sage-50 border-2 border-sage-400"
                          : isDark ? "bg-charcoal-800" : "bg-cream-50"
                      )}
                    >
                      <View className="flex-1 mr-3">
                        <Text
                          className={cn(
                            "text-base font-semibold",
                            isDark ? "text-white" : "text-charcoal-900"
                          )}
                          numberOfLines={1}
                        >
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
                        <View className="flex-row items-center mt-2 space-x-3">
                          <Text className={cn(
                            "text-xs",
                            isDark ? "text-charcoal-500" : "text-charcoal-400"
                          )}>
                            {recipe.prepTime + recipe.cookTime} min
                          </Text>
                          <Text className={cn(
                            "text-xs",
                            isDark ? "text-charcoal-500" : "text-charcoal-400"
                          )}>
                            {recipe.calories ?? 0} cal
                          </Text>
                          <Text className={cn(
                            "text-xs",
                            isDark ? "text-charcoal-500" : "text-charcoal-400"
                          )}>
                            {recipe.servings} servings
                          </Text>
                        </View>
                      </View>
                      <View className={cn(
                        "w-7 h-7 rounded-full items-center justify-center",
                        isSelected
                          ? isDark ? "bg-sage-600" : "bg-sage-500"
                          : isDark ? "bg-charcoal-700" : "bg-cream-200"
                      )}>
                        {isSelected && <Check size={16} color="#fff" />}
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View className="items-center py-10">
                  <BookOpen size={40} color={isDark ? '#6d6d6d' : '#888888'} />
                  <Text className={cn(
                    "text-base font-medium mt-4",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    No recipes yet
                  </Text>
                  <Text className={cn(
                    "text-sm mt-1 text-center",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    Generate your first recipe to get started
                  </Text>
                </View>
              )}
              <View className="h-10" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Preferences Edit Modal */}
      <Modal
        visible={showPreferencesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPreferencesModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className={cn(
              "rounded-t-3xl max-h-[85%]",
              isDark ? "bg-charcoal-900" : "bg-white"
            )}
          >
            {/* Modal Header */}
            <View className={cn(
              "flex-row items-center justify-between px-5 py-4 border-b",
              isDark ? "border-charcoal-800" : "border-cream-200"
            )}>
              <Pressable
                onPress={() => setShowPreferencesModal(false)}
                className="w-16"
              >
                <Text className={cn(
                  "text-base",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  Cancel
                </Text>
              </Pressable>
              <Text className={cn(
                "text-lg font-semibold",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Edit Preferences
              </Text>
              <Pressable
                onPress={() => setShowPreferencesModal(false)}
                className="w-16 items-end"
              >
                <Text className={cn(
                  "text-base font-semibold",
                  isDark ? "text-sage-400" : "text-sage-600"
                )}>
                  Done
                </Text>
              </Pressable>
            </View>

            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
            >
              {/* Note about temporary preferences */}
              <View className={cn(
                "flex-row items-center p-3 rounded-xl mb-6",
                isDark ? "bg-charcoal-800" : "bg-cream-100"
              )}>
                <AlertCircle size={16} color={isDark ? '#888888' : '#6d6d6d'} />
                <Text className={cn(
                  "text-xs ml-2 flex-1",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  These preferences are only for this generation. Your saved preferences won't change.
                </Text>
              </View>

              {/* Serving Size */}
              <View className="mb-6">
                <Text className={cn(
                  "text-base font-semibold mb-3",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Servings
                </Text>
                <View className="flex-row items-center">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setLocalPreferences(prev => ({
                        ...prev,
                        servingSize: Math.max(1, prev.servingSize - 1)
                      }));
                    }}
                    className={cn(
                      "w-12 h-12 rounded-xl items-center justify-center",
                      isDark ? "bg-charcoal-800" : "bg-cream-100"
                    )}
                  >
                    <Minus size={20} color={isDark ? '#fff' : '#262626'} />
                  </Pressable>
                  <View className="flex-1 items-center">
                    <Text className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {localPreferences.servingSize}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setLocalPreferences(prev => ({
                        ...prev,
                        servingSize: Math.min(12, prev.servingSize + 1)
                      }));
                    }}
                    className={cn(
                      "w-12 h-12 rounded-xl items-center justify-center",
                      isDark ? "bg-charcoal-800" : "bg-cream-100"
                    )}
                  >
                    <Plus size={20} color={isDark ? '#fff' : '#262626'} />
                  </Pressable>
                </View>
              </View>

              {/* Skill Level */}
              <View className="mb-6">
                <Text className={cn(
                  "text-base font-semibold mb-3",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Cooking Skill Level
                </Text>
                <View className="flex-row">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                    <Pressable
                      key={level}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setLocalPreferences(prev => ({ ...prev, cookingSkillLevel: level }));
                      }}
                      className={cn(
                        "flex-1 py-3 rounded-xl mr-2 items-center",
                        localPreferences.cookingSkillLevel === level
                          ? isDark ? "bg-sage-600" : "bg-sage-500"
                          : isDark ? "bg-charcoal-800" : "bg-cream-100"
                      )}
                    >
                      <Text className={cn(
                        "text-sm font-medium capitalize",
                        localPreferences.cookingSkillLevel === level
                          ? "text-white"
                          : isDark ? "text-charcoal-300" : "text-charcoal-600"
                      )}>
                        {level}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Prep Time */}
              <View className="mb-6">
                <Text className={cn(
                  "text-base font-semibold mb-3",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Prep Time Preference
                </Text>
                <View className="flex-row">
                  {(['quick', 'moderate', 'elaborate'] as const).map((time) => (
                    <Pressable
                      key={time}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setLocalPreferences(prev => ({ ...prev, mealPrepTime: time }));
                      }}
                      className={cn(
                        "flex-1 py-3 rounded-xl mr-2 items-center",
                        localPreferences.mealPrepTime === time
                          ? isDark ? "bg-sage-600" : "bg-sage-500"
                          : isDark ? "bg-charcoal-800" : "bg-cream-100"
                      )}
                    >
                      <Text className={cn(
                        "text-sm font-medium capitalize",
                        localPreferences.mealPrepTime === time
                          ? "text-white"
                          : isDark ? "text-charcoal-300" : "text-charcoal-600"
                      )}>
                        {time}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Dietary Restrictions */}
              <View className="mb-6">
                <Text className={cn(
                  "text-base font-semibold mb-3",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Dietary Restrictions
                </Text>
                <View className="flex-row flex-wrap">
                  {['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Low-Carb', 'Low-Sodium'].map((diet) => {
                    const isSelected = localPreferences.dietaryRestrictions.includes(diet);
                    return (
                      <Pressable
                        key={diet}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setLocalPreferences(prev => ({
                            ...prev,
                            dietaryRestrictions: isSelected
                              ? prev.dietaryRestrictions.filter(d => d !== diet)
                              : [...prev.dietaryRestrictions, diet]
                          }));
                        }}
                        className={cn(
                          "px-4 py-2 rounded-full mr-2 mb-2",
                          isSelected
                            ? isDark ? "bg-terracotta-600" : "bg-terracotta-500"
                            : isDark ? "bg-charcoal-800" : "bg-cream-100"
                        )}
                      >
                        <Text className={cn(
                          "text-sm font-medium",
                          isSelected
                            ? "text-white"
                            : isDark ? "text-charcoal-300" : "text-charcoal-600"
                        )}>
                          {diet}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Cuisine Preferences */}
              <View className="mb-6">
                <Text className={cn(
                  "text-base font-semibold mb-3",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Cuisine Preferences
                </Text>
                <View className="flex-row flex-wrap">
                  {['Italian', 'Mexican', 'Asian', 'Mediterranean', 'American', 'Indian', 'French', 'Japanese', 'Thai', 'Greek'].map((cuisine) => {
                    const isSelected = localPreferences.cuisinePreferences.includes(cuisine);
                    return (
                      <Pressable
                        key={cuisine}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setLocalPreferences(prev => ({
                            ...prev,
                            cuisinePreferences: isSelected
                              ? prev.cuisinePreferences.filter(c => c !== cuisine)
                              : [...prev.cuisinePreferences, cuisine]
                          }));
                        }}
                        className={cn(
                          "px-4 py-2 rounded-full mr-2 mb-2",
                          isSelected
                            ? isDark ? "bg-sage-600" : "bg-sage-500"
                            : isDark ? "bg-charcoal-800" : "bg-cream-100"
                        )}
                      >
                        <Text className={cn(
                          "text-sm font-medium",
                          isSelected
                            ? "text-white"
                            : isDark ? "text-charcoal-300" : "text-charcoal-600"
                        )}>
                          {cuisine}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Allergies */}
              <View className="mb-6">
                <Text className={cn(
                  "text-base font-semibold mb-3",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Allergies to Avoid
                </Text>
                <View className="flex-row flex-wrap">
                  {['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Fish', 'Wheat', 'Sesame'].map((allergy) => {
                    const isSelected = localPreferences.allergies.includes(allergy);
                    return (
                      <Pressable
                        key={allergy}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setLocalPreferences(prev => ({
                            ...prev,
                            allergies: isSelected
                              ? prev.allergies.filter(a => a !== allergy)
                              : [...prev.allergies, allergy]
                          }));
                        }}
                        className={cn(
                          "px-4 py-2 rounded-full mr-2 mb-2",
                          isSelected
                            ? "bg-red-500"
                            : isDark ? "bg-charcoal-800" : "bg-cream-100"
                        )}
                      >
                        <Text className={cn(
                          "text-sm font-medium",
                          isSelected
                            ? "text-white"
                            : isDark ? "text-charcoal-300" : "text-charcoal-600"
                        )}>
                          {allergy}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Reset to Profile Preferences */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setLocalPreferences(preferences);
                }}
                className={cn(
                  "flex-row items-center justify-center py-3 rounded-xl mb-4",
                  isDark ? "bg-charcoal-800" : "bg-cream-100"
                )}
              >
                <RefreshCw size={16} color={isDark ? '#888888' : '#6d6d6d'} />
                <Text className={cn(
                  "text-sm font-medium ml-2",
                  isDark ? "text-charcoal-300" : "text-charcoal-600"
                )}>
                  Reset to Profile Preferences
                </Text>
              </Pressable>

              <View className="h-10" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
