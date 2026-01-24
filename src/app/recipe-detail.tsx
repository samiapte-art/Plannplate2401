import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Dimensions, Modal, Share as RNShare } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Clock,
  Flame,
  Users,
  ChefHat,
  Sparkles,
  Plus,
  Check,
  Share2,
  Link as LinkIcon,
  Upload,
  PenLine,
  ExternalLink,
  Trash2,
  AlertTriangle
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useMealPlanStore } from '@/lib/store';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id, slotId } = useLocalSearchParams<{ id: string; slotId?: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const recipes = useMealPlanStore((s) => s.recipes);
  const mealSlots = useMealPlanStore((s) => s.mealSlots);
  const toggleSaveRecipe = useMealPlanStore((s) => s.toggleSaveRecipe);
  const deleteRecipe = useMealPlanStore((s) => s.deleteRecipe);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const recipe = useMemo(() => {
    return recipes.find((r) => r.id === id);
  }, [recipes, id]);

  // Get the meal slot if slotId is provided
  const mealSlot = useMemo(() => {
    if (!slotId) return null;
    return mealSlots.find((s) => s.id === slotId);
  }, [mealSlots, slotId]);

  // Calculate serving multiplier based on meal slot's serving override
  const servingMultiplier = useMemo(() => {
    if (!recipe || !mealSlot?.servingOverride) return 1;
    return mealSlot.servingOverride / recipe.servings;
  }, [recipe, mealSlot]);

  // Calculate adjusted ingredients
  const adjustedIngredients = useMemo(() => {
    if (!recipe) return [];
    return recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: (parseFloat(ing.quantity) * servingMultiplier).toFixed(2).replace(/\.?0+$/, ''),
    }));
  }, [recipe, servingMultiplier]);

  // Get display servings (override or original)
  const displayServings = mealSlot?.servingOverride ?? recipe?.servings ?? 0;

  const handleToggleSave = useCallback(() => {
    if (!recipe) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleSaveRecipe(recipe.id);
  }, [recipe, toggleSaveRecipe]);

  const handleAddToMealPlan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/select-recipe',
      params: { recipeId: id, mode: 'add-to-plan' }
    });
  }, [router, id]);

  const handleOpenSourceUrl = useCallback(() => {
    if (recipe?.sourceUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(recipe.sourceUrl);
    }
  }, [recipe?.sourceUrl]);

  const handleDeletePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDeleteModal(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!recipe) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deleteRecipe(recipe.id);
    setShowDeleteModal(false);
    router.back();
  }, [recipe, deleteRecipe, router]);

  const handleShare = useCallback(async () => {
    if (!recipe) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Format ingredients list using adjusted ingredients
    const ingredientsList = adjustedIngredients
      .map(ing => `• ${ing.quantity} ${ing.unit} ${ing.name}`)
      .join('\n');

    // Format instructions list
    const instructionsList = recipe.instructions
      .map((inst, idx) => `${idx + 1}. ${inst}`)
      .join('\n');

    // Create the share message with display servings
    const shareMessage = `${recipe.name}\n\nDescription: ${recipe.description}\n\nCooking Time: ${recipe.cookTime} min\nPrep Time: ${recipe.prepTime} min\nServings: ${displayServings}\nCalories: ${recipe.calories}\n\nIngredients:\n${ingredientsList}\n\nInstructions:\n${instructionsList}`;

    try {
      await RNShare.share({
        message: shareMessage,
        title: recipe.name,
        url: recipe.imageUrl, // Include image URL (some apps will use this)
      });
    } catch (error) {
      console.error('Error sharing recipe:', error);
    }
  }, [recipe, adjustedIngredients, displayServings]);

  if (!recipe) {
    return (
      <View className={cn("flex-1 items-center justify-center", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
        <Text className={cn("text-lg", isDark ? "text-white" : "text-charcoal-900")}>Recipe not found</Text>
      </View>
    );
  }

  return (
    <View className={cn("flex-1", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero Image */}
        <View className="relative">
          <Image
            source={{ uri: recipe.imageUrl }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.8 }}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', isDark ? '#262626' : '#fefdfb']}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />

          {/* Header Buttons */}
          <SafeAreaView className="absolute top-0 left-0 right-0" edges={['top']}>
            <View className="flex-row items-center justify-between px-4 pt-2">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
              >
                <ArrowLeft size={22} color="#fff" />
              </Pressable>
              <View className="flex-row space-x-2">
                <Pressable
                  onPress={handleDeletePress}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Trash2 size={20} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={handleToggleSave}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Heart
                    size={20}
                    color="#fff"
                    fill={recipe.isSaved ? '#fff' : 'transparent'}
                  />
                </Pressable>
                <Pressable
                  onPress={handleShare}
                  className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
                >
                  <Share2 size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>

          {/* Tags */}
          <View className="absolute bottom-20 left-4 flex-row items-center">
            {recipe.isAIGenerated && (
              <View className="w-8 h-8 items-center justify-center bg-terracotta-500 rounded-full">
                <Sparkles size={16} color="#fff" />
              </View>
            )}
            {!recipe.isAIGenerated && recipe.isImported && (
              <View className="w-8 h-8 items-center justify-center bg-blue-500 rounded-full">
                <Upload size={16} color="#fff" />
              </View>
            )}
            {!recipe.isAIGenerated && !recipe.isImported && (
              <View className="w-8 h-8 items-center justify-center bg-sage-500 rounded-full">
                <PenLine size={16} color="#fff" />
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View className="px-5 -mt-6">
          {/* Title Card */}
          <Animated.View
            entering={FadeInUp.delay(100).springify()}
            className={cn(
              "rounded-3xl p-5",
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
            <Text className={cn(
              "text-2xl font-bold",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              {recipe.name}
            </Text>
            <Text className={cn(
              "text-base mt-2",
              isDark ? "text-charcoal-400" : "text-charcoal-500"
            )}>
              {recipe.description}
            </Text>

            {/* Source URL */}
            {recipe.sourceUrl && (
              <Pressable
                onPress={handleOpenSourceUrl}
                className={cn(
                  "flex-row items-center mt-3 px-3 py-2 rounded-xl self-start",
                  isDark ? "bg-blue-900/30" : "bg-blue-50"
                )}
              >
                <LinkIcon size={14} color="#3b82f6" />
                <Text
                  className="text-sm text-blue-500 ml-2 flex-shrink"
                  numberOfLines={1}
                >
                  View original recipe
                </Text>
                <ExternalLink size={12} color="#3b82f6" className="ml-1" />
              </Pressable>
            )}

            {/* Stats */}
            <View className="flex-row mt-4 space-x-4">
              <View className="flex-row items-center">
                <View className={cn(
                  "w-8 h-8 rounded-lg items-center justify-center",
                  isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}>
                  <Clock size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                </View>
                <View className="ml-2">
                  <Text className={cn(
                    "text-xs",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    Total Time
                  </Text>
                  <Text className={cn(
                    "text-sm font-semibold",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    {recipe.cookTime + recipe.prepTime} min
                  </Text>
                </View>
              </View>

              {recipe.calories && (
                <View className="flex-row items-center">
                  <View className={cn(
                    "w-8 h-8 rounded-lg items-center justify-center",
                    isDark ? "bg-charcoal-700" : "bg-cream-100"
                  )}>
                    <Flame size={16} color={isDark ? '#f5b8a0' : '#e46d46'} />
                  </View>
                  <View className="ml-2">
                    <Text className={cn(
                      "text-xs",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Calories
                    </Text>
                    <Text className={cn(
                      "text-sm font-semibold",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {recipe.calories} cal
                    </Text>
                  </View>
                </View>
              )}

              <View className="flex-row items-center">
                <View className={cn(
                  "w-8 h-8 rounded-lg items-center justify-center",
                  isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}>
                  <Users size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                </View>
                <View className="ml-2">
                  <Text className={cn(
                    "text-xs",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    Servings
                  </Text>
                  <Text className={cn(
                    "text-sm font-semibold",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    {displayServings}
                  </Text>
                </View>
              </View>
            </View>

            {/* Tags */}
            <View className="flex-row flex-wrap mt-4">
              {recipe.tags.map((tag) => (
                <View
                  key={tag}
                  className={cn(
                    "px-3 py-1.5 rounded-full mr-2 mb-2",
                    isDark ? "bg-charcoal-700" : "bg-cream-100"
                  )}
                >
                  <Text className={cn(
                    "text-xs font-medium capitalize",
                    isDark ? "text-charcoal-300" : "text-charcoal-600"
                  )}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Ingredients Section */}
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            className="mt-6"
          >
            <View className="flex-row items-center mb-4">
              <ChefHat size={20} color={isDark ? '#a6b594' : '#6a7d56'} />
              <Text className={cn(
                "text-lg font-bold ml-2",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Ingredients
              </Text>
              <Text className={cn(
                "text-sm ml-2",
                isDark ? "text-charcoal-500" : "text-charcoal-400"
              )}>
                ({adjustedIngredients.length} items)
              </Text>
            </View>

            <View className={cn(
              "rounded-2xl p-4",
              isDark ? "bg-charcoal-800/50" : "bg-white"
            )}>
              {adjustedIngredients.map((ingredient, index) => (
                <View
                  key={ingredient.id}
                  className={cn(
                    "flex-row items-center py-3",
                    index < adjustedIngredients.length - 1 && (isDark ? "border-b border-charcoal-700" : "border-b border-cream-200")
                  )}
                >
                  <View className={cn(
                    "w-6 h-6 rounded-full items-center justify-center mr-3",
                    isDark ? "bg-sage-800" : "bg-sage-100"
                  )}>
                    <Check size={14} color={isDark ? '#a6b594' : '#6a7d56'} />
                  </View>
                  <Text className={cn(
                    "flex-1 text-base",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    {ingredient.name}
                  </Text>
                  <Text className={cn(
                    "text-base font-medium",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    {ingredient.quantity} {ingredient.unit}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Instructions Section */}
          <Animated.View
            entering={FadeInDown.delay(300).springify()}
            className="mt-6 mb-32"
          >
            <Text className={cn(
              "text-lg font-bold mb-4",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              Instructions
            </Text>

            {recipe.instructions.map((instruction, index) => (
              <View
                key={index}
                className={cn(
                  "flex-row mb-4 p-4 rounded-2xl",
                  isDark ? "bg-charcoal-800/50" : "bg-white"
                )}
              >
                <View className={cn(
                  "w-8 h-8 rounded-xl items-center justify-center mr-3",
                  isDark ? "bg-sage-800" : "bg-sage-100"
                )}>
                  <Text className={cn(
                    "text-sm font-bold",
                    isDark ? "text-sage-300" : "text-sage-700"
                  )}>
                    {index + 1}
                  </Text>
                </View>
                <Text className={cn(
                  "flex-1 text-base leading-6",
                  isDark ? "text-charcoal-200" : "text-charcoal-700"
                )}>
                  {instruction}
                </Text>
              </View>
            ))}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
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
        <Pressable
          onPress={handleAddToMealPlan}
          className={cn(
            "flex-row items-center justify-center py-4 rounded-2xl",
            isDark ? "bg-sage-600" : "bg-sage-500"
          )}
          style={{
            shadowColor: '#6a7d56',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Plus size={20} color="#fff" />
          <Text className="text-white text-base font-semibold ml-2">
            Add to Meal Plan
          </Text>
        </Pressable>
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View
            className={cn(
              "w-full rounded-3xl p-6",
              isDark ? "bg-charcoal-800" : "bg-white"
            )}
          >
            {/* Warning Icon */}
            <View className="items-center mb-4">
              <View className={cn(
                "w-16 h-16 rounded-full items-center justify-center",
                isDark ? "bg-red-900/30" : "bg-red-50"
              )}>
                <AlertTriangle size={32} color="#ef4444" />
              </View>
            </View>

            <Text className={cn(
              "text-xl font-bold text-center mb-2",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              Delete Recipe?
            </Text>
            <Text className={cn(
              "text-base text-center mb-6",
              isDark ? "text-charcoal-400" : "text-charcoal-500"
            )}>
              Are you sure you want to delete "{recipe.name}"? This action cannot be undone.
            </Text>

            {/* Buttons */}
            <View className="flex-row space-x-3">
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                className={cn(
                  "flex-1 py-4 rounded-2xl items-center justify-center",
                  isDark ? "bg-charcoal-700" : "bg-cream-200"
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
                onPress={handleConfirmDelete}
                className="flex-1 py-4 rounded-2xl items-center justify-center bg-red-500"
              >
                <Text className="text-white text-base font-semibold">
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
