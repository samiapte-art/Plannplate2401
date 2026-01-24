import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Search, Clock, Check, Coffee, Sun, Moon, Utensils, CheckSquare, Square } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMealPlanStore, type Recipe, type MealSlot } from '@/lib/store';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';

// Helper function to format date as YYYY-MM-DD in local timezone
function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MEAL_TYPE_CONFIG = {
  breakfast: { icon: Coffee, label: 'Breakfast' },
  lunch: { icon: Sun, label: 'Lunch' },
  dinner: { icon: Moon, label: 'Dinner' },
  snack: { icon: Utensils, label: 'Snack' },
} as const;

interface RecipeItemProps {
  recipe: Recipe;
  isSelected: boolean;
  onSelect: () => void;
  isDark: boolean;
  index: number;
  multiSelect?: boolean;
}

function RecipeItem({ recipe, isSelected, onSelect, isDark, index, multiSelect }: RecipeItemProps) {
  return (
    <Animated.View entering={FadeInRight.delay(Math.min(index * 50, 300)).springify()}>
      <Pressable
        onPress={onSelect}
        className={cn(
          "flex-row items-center p-3 rounded-2xl mb-2",
          isSelected
            ? isDark ? "bg-sage-800/50 border border-sage-600" : "bg-sage-50 border border-sage-300"
            : isDark ? "bg-charcoal-800/50" : "bg-white"
        )}
      >
        <Image
          source={{ uri: recipe.imageUrl }}
          className="w-16 h-16 rounded-xl"
        />
        <View className="flex-1 ml-3">
          <Text className={cn(
            "text-base font-semibold",
            isDark ? "text-white" : "text-charcoal-900"
          )} numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text className={cn(
            "text-sm mt-0.5",
            isDark ? "text-charcoal-400" : "text-charcoal-500"
          )} numberOfLines={1}>
            {recipe.description}
          </Text>
          <View className="flex-row items-center mt-1">
            <Clock size={12} color={isDark ? '#888888' : '#6d6d6d'} />
            <Text className={cn(
              "text-xs ml-1",
              isDark ? "text-charcoal-400" : "text-charcoal-500"
            )}>
              {recipe.cookTime + recipe.prepTime} min
            </Text>
            {recipe.calories && (
              <>
                <Text className={cn(
                  "text-xs mx-1",
                  isDark ? "text-charcoal-600" : "text-charcoal-300"
                )}>
                  •
                </Text>
                <Text className={cn(
                  "text-xs",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  {recipe.calories} cal
                </Text>
              </>
            )}
          </View>
        </View>
        <View className={cn(
          "w-7 h-7 rounded-full items-center justify-center ml-2",
          isSelected
            ? "bg-sage-500"
            : isDark ? "bg-charcoal-700" : "bg-cream-200"
        )}>
          {isSelected && <Check size={16} color="#fff" strokeWidth={3} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function SelectRecipeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mealType?: string;
    date?: string;
    recipeId?: string;
    mode?: string;
  }>();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const recipes = useMealPlanStore((s) => s.recipes);
  const addMealToSlot = useMealPlanStore((s) => s.addMealToSlot);
  const mealSlots = useMealPlanStore((s) => s.mealSlots);

  const [searchQuery, setSearchQuery] = useState('');
  // Support multi-select: use array for multiple selections
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>(
    params.recipeId ? [params.recipeId] : []
  );
  const [selectedMealType, setSelectedMealType] = useState<string>(
    params.mealType ?? 'dinner'
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    params.date ?? formatLocalDateKey(new Date())
  );

  // Mode determines if we're selecting a recipe for a slot, or selecting a slot for a recipe
  const isAddToSlotMode = params.mode === 'add-to-plan' && params.recipeId;

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;

    const query = searchQuery.toLowerCase();
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.tags.some((t) => t.toLowerCase().includes(query))
    );
  }, [recipes, searchQuery]);

  const handleSelectRecipe = useCallback((recipeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecipeIds(prev => {
      if (prev.includes(recipeId)) {
        // Deselect if already selected
        return prev.filter(id => id !== recipeId);
      } else {
        // Add to selection
        return [...prev, recipeId];
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectedRecipeIds.length === filteredRecipes.length) {
      // Deselect all
      setSelectedRecipeIds([]);
    } else {
      // Select all filtered recipes
      setSelectedRecipeIds(filteredRecipes.map(r => r.id));
    }
  }, [filteredRecipes, selectedRecipeIds.length]);

  const handleConfirm = useCallback(() => {
    if (selectedRecipeIds.length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Add all selected recipes to the meal slot
    selectedRecipeIds.forEach(recipeId => {
      const slot: MealSlot = {
        id: '',
        date: selectedDate,
        mealType: selectedMealType as MealSlot['mealType'],
        recipeId: recipeId,
      };
      addMealToSlot(slot);
    });

    router.back();
  }, [selectedRecipeIds, selectedDate, selectedMealType, addMealToSlot, router]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Generate next 7 days for date picker
  const dateOptions = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(formatLocalDateKey(date));
    }
    return dates;
  }, []);

  const allSelected = filteredRecipes.length > 0 && selectedRecipeIds.length === filteredRecipes.length;

  return (
    <View className={cn("flex-1", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
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
              isDark ? "bg-charcoal-800" : "bg-white"
            )}
          >
            <X size={20} color={isDark ? '#fff' : '#262626'} />
          </Pressable>
          <Text className={cn(
            "text-lg font-bold",
            isDark ? "text-white" : "text-charcoal-900"
          )}>
            {isAddToSlotMode ? 'Add to Meal Plan' : 'Select Recipes'}
          </Text>
          <View className="w-10" />
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Date Selector (if adding to plan) */}
          {isAddToSlotMode && (
            <Animated.View
              entering={FadeInDown.delay(150).springify()}
              className="px-5 mb-4"
            >
              <Text className={cn(
                "text-sm font-medium mb-2",
                isDark ? "text-charcoal-400" : "text-charcoal-500"
              )}>
                Select Date
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {dateOptions.map((date, index) => {
                  const isSelected = date === selectedDate;
                  const dateObj = new Date(date);
                  const isToday = date === formatLocalDateKey(new Date());

                  return (
                    <Pressable
                      key={date}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedDate(date);
                      }}
                      className={cn(
                        "items-center px-4 py-3 rounded-2xl mr-2",
                        isSelected
                          ? isDark ? "bg-sage-600" : "bg-sage-500"
                          : isDark ? "bg-charcoal-800" : "bg-white"
                      )}
                    >
                      <Text className={cn(
                        "text-xs font-medium",
                        isSelected
                          ? "text-white"
                          : isDark ? "text-charcoal-400" : "text-charcoal-500"
                      )}>
                        {isToday ? 'Today' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()]}
                      </Text>
                      <Text className={cn(
                        "text-lg font-bold mt-1",
                        isSelected
                          ? "text-white"
                          : isDark ? "text-white" : "text-charcoal-900"
                      )}>
                        {dateObj.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

          {/* Meal Type Selector */}
          <Animated.View
            entering={FadeInDown.delay(isAddToSlotMode ? 200 : 150).springify()}
            className="px-5 mb-4"
          >
            <Text className={cn(
              "text-sm font-medium mb-2",
              isDark ? "text-charcoal-400" : "text-charcoal-500"
            )}>
              Meal Type
            </Text>
            <View className="flex-row">
              {Object.entries(MEAL_TYPE_CONFIG).map(([key, config]) => {
                const isSelected = key === selectedMealType;
                const Icon = config.icon;

                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedMealType(key);
                    }}
                    className={cn(
                      "flex-1 flex-row items-center justify-center py-3 rounded-xl mr-2",
                      isSelected
                        ? isDark ? "bg-sage-600" : "bg-sage-500"
                        : isDark ? "bg-charcoal-800" : "bg-white"
                    )}
                  >
                    <Icon
                      size={16}
                      color={isSelected ? '#fff' : isDark ? '#888888' : '#6d6d6d'}
                    />
                    <Text className={cn(
                      "text-sm font-medium ml-1.5",
                      isSelected
                        ? "text-white"
                        : isDark ? "text-charcoal-300" : "text-charcoal-600"
                    )}>
                      {config.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Search Bar */}
          {!isAddToSlotMode && (
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              className="px-5 mb-4"
            >
              <View className={cn(
                "flex-row items-center rounded-xl px-4 py-3",
                isDark ? "bg-charcoal-800" : "bg-white"
              )}>
                <Search size={18} color={isDark ? '#888888' : '#6d6d6d'} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search recipes..."
                  placeholderTextColor={isDark ? '#888888' : '#6d6d6d'}
                  className={cn(
                    "flex-1 ml-3 text-base",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}
                />
              </View>
            </Animated.View>
          )}

          {/* Recipe List */}
          <View className="px-5">
            {/* Header with count and select all */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className={cn(
                "text-sm font-medium",
                isDark ? "text-charcoal-400" : "text-charcoal-500"
              )}>
                {isAddToSlotMode ? 'Adding:' : `${filteredRecipes.length} recipes available`}
              </Text>

              {!isAddToSlotMode && filteredRecipes.length > 0 && (
                <Pressable
                  onPress={handleSelectAll}
                  className="flex-row items-center"
                >
                  {allSelected ? (
                    <CheckSquare size={18} color={isDark ? '#a6b594' : '#6a7d56'} />
                  ) : (
                    <Square size={18} color={isDark ? '#888888' : '#6d6d6d'} />
                  )}
                  <Text className={cn(
                    "text-sm font-medium ml-1.5",
                    allSelected
                      ? isDark ? "text-sage-400" : "text-sage-600"
                      : isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Selection count badge */}
            {!isAddToSlotMode && selectedRecipeIds.length > 0 && (
              <View className={cn(
                "flex-row items-center px-3 py-2 rounded-xl mb-3",
                isDark ? "bg-sage-900/30" : "bg-sage-50"
              )}>
                <Check size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                <Text className={cn(
                  "text-sm font-medium ml-2",
                  isDark ? "text-sage-300" : "text-sage-700"
                )}>
                  {selectedRecipeIds.length} recipe{selectedRecipeIds.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
            )}

            {isAddToSlotMode && selectedRecipeIds[0] ? (
              // Show selected recipe when in add-to-plan mode
              (() => {
                const recipe = recipes.find((r) => r.id === selectedRecipeIds[0]);
                if (!recipe) return null;

                return (
                  <View className={cn(
                    "p-4 rounded-2xl mb-4",
                    isDark ? "bg-sage-800/30 border border-sage-700" : "bg-sage-50 border border-sage-200"
                  )}>
                    <View className="flex-row items-center">
                      <Image
                        source={{ uri: recipe.imageUrl }}
                        className="w-20 h-20 rounded-xl"
                      />
                      <View className="flex-1 ml-3">
                        <Text className={cn(
                          "text-lg font-bold",
                          isDark ? "text-white" : "text-charcoal-900"
                        )}>
                          {recipe.name}
                        </Text>
                        <Text className={cn(
                          "text-sm mt-1",
                          isDark ? "text-charcoal-400" : "text-charcoal-500"
                        )}>
                          {recipe.cookTime + recipe.prepTime} min • {recipe.calories} cal
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()
            ) : (
              // Show recipe list when selecting recipes
              filteredRecipes.map((recipe, index) => (
                <RecipeItem
                  key={recipe.id}
                  recipe={recipe}
                  isSelected={selectedRecipeIds.includes(recipe.id)}
                  onSelect={() => handleSelectRecipe(recipe.id)}
                  isDark={isDark}
                  index={index}
                  multiSelect={true}
                />
              ))
            )}

            {/* Empty state */}
            {filteredRecipes.length === 0 && (
              <View className="items-center py-10">
                <Search size={40} color={isDark ? '#6d6d6d' : '#888888'} />
                <Text className={cn(
                  "text-base font-medium mt-4",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  No recipes found
                </Text>
                <Text className={cn(
                  "text-sm mt-1 text-center",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  Try a different search term
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Confirm Button */}
        <View className={cn(
          "absolute bottom-0 left-0 right-0 px-5 pb-10 pt-4",
          isDark ? "bg-charcoal-900" : "bg-cream-50"
        )}>
          <Pressable
            onPress={handleConfirm}
            disabled={selectedRecipeIds.length === 0}
            className={cn(
              "py-4 rounded-2xl items-center",
              selectedRecipeIds.length > 0
                ? isDark ? "bg-sage-600" : "bg-sage-500"
                : isDark ? "bg-charcoal-800" : "bg-cream-200"
            )}
          >
            <Text className={cn(
              "text-base font-semibold",
              selectedRecipeIds.length > 0
                ? "text-white"
                : isDark ? "text-charcoal-600" : "text-charcoal-400"
            )}>
              {isAddToSlotMode
                ? `Add to ${MEAL_TYPE_CONFIG[selectedMealType as keyof typeof MEAL_TYPE_CONFIG]?.label || 'Meal'}`
                : selectedRecipeIds.length > 0
                  ? `Add ${selectedRecipeIds.length} Recipe${selectedRecipeIds.length !== 1 ? 's' : ''} to Meal Plan`
                  : 'Select Recipes'
              }
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
