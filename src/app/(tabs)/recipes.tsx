import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Search, Plus, Clock, Flame, Heart, Filter, Sparkles, X, Download, Upload, PenLine, Link as LinkIcon } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useMealPlanStore, type Recipe } from '@/lib/store';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'quick', label: 'Quick' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'protein', label: 'High Protein' },
] as const;

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
  onToggleSave: () => void;
  isDark: boolean;
  index: number;
}

function RecipeCard({ recipe, onPress, onToggleSave, isDark, index }: RecipeCardProps) {
  const handleSavePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleSave();
  }, [onToggleSave]);

  const handleLinkPress = useCallback(() => {
    if (recipe.sourceUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(recipe.sourceUrl);
    }
  }, [recipe.sourceUrl]);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).springify()}
      layout={Layout.springify()}
    >
      <Pressable
        onPress={onPress}
        className={cn(
          "mb-4 rounded-3xl overflow-hidden",
          isDark ? "bg-charcoal-800" : "bg-white"
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        <View className="relative">
          <Image
            source={{ uri: recipe.imageUrl }}
            className="w-full h-44"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
            }}
          />
          {recipe.isAIGenerated && (
            <View className="absolute top-3 left-3 w-7 h-7 items-center justify-center bg-terracotta-500 rounded-full">
              <Sparkles size={14} color="#fff" />
            </View>
          )}
          {!recipe.isAIGenerated && recipe.isImported && (
            <View className="absolute top-3 left-3 w-7 h-7 items-center justify-center bg-blue-500 rounded-full">
              <Upload size={14} color="#fff" />
            </View>
          )}
          {!recipe.isAIGenerated && !recipe.isImported && (
            <View className="absolute top-3 left-3 w-7 h-7 items-center justify-center bg-sage-500 rounded-full">
              <PenLine size={14} color="#fff" />
            </View>
          )}
          <View className="absolute top-3 right-3 flex-row items-center">
            {recipe.sourceUrl && (
              <Pressable
                onPress={handleLinkPress}
                className="w-9 h-9 rounded-full bg-white/90 items-center justify-center mr-2"
              >
                <LinkIcon size={16} color="#3b82f6" />
              </Pressable>
            )}
            <Pressable
              onPress={handleSavePress}
              className="w-9 h-9 rounded-full bg-white/90 items-center justify-center"
            >
              <Heart
                size={18}
                color={recipe.isSaved ? '#e46d46' : '#6d6d6d'}
                fill={recipe.isSaved ? '#e46d46' : 'transparent'}
              />
            </Pressable>
          </View>
          <View className="absolute bottom-3 left-3 flex-row">
            {recipe.tags.slice(0, 2).map((tag) => (
              <View
                key={tag}
                className="bg-white/20 px-2.5 py-1 rounded-full mr-2"
              >
                <Text className="text-xs font-medium text-white capitalize">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="p-4">
          <Text className={cn(
            "text-lg font-bold",
            isDark ? "text-white" : "text-charcoal-900"
          )}>
            {recipe.name}
          </Text>
          <Text className={cn(
            "text-sm mt-1",
            isDark ? "text-charcoal-400" : "text-charcoal-500"
          )} numberOfLines={2}>
            {recipe.description}
          </Text>
          <View className="flex-row items-center mt-3 space-x-4">
            <View className="flex-row items-center">
              <Clock size={14} color={isDark ? '#a6b594' : '#6a7d56'} />
              <Text className={cn(
                "text-sm ml-1.5 font-medium",
                isDark ? "text-charcoal-300" : "text-charcoal-600"
              )}>
                {recipe.cookTime + recipe.prepTime} min
              </Text>
            </View>
            {recipe.calories && (
              <View className="flex-row items-center">
                <Flame size={14} color={isDark ? '#f5b8a0' : '#e46d46'} />
                <Text className={cn(
                  "text-sm ml-1.5 font-medium",
                  isDark ? "text-charcoal-300" : "text-charcoal-600"
                )}>
                  {recipe.calories} cal
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function RecipesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const recipes = useMealPlanStore((s) => s.recipes);
  const toggleSaveRecipe = useMealPlanStore((s) => s.toggleSaveRecipe);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const filteredRecipes = useMemo(() => {
    let filtered = recipes;

    // Filter by saved
    if (showSavedOnly) {
      filtered = filtered.filter((r) => r.isSaved);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((r) =>
        r.tags.some((t) => t.toLowerCase() === selectedCategory.toLowerCase())
      );
    }

    return filtered;
  }, [recipes, searchQuery, selectedCategory, showSavedOnly]);

  const handleRecipePress = useCallback((recipe: Recipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/recipe-detail',
      params: { id: recipe.id }
    });
  }, [router]);

  const handleToggleSave = useCallback((recipeId: string) => {
    toggleSaveRecipe(recipeId);
  }, [toggleSaveRecipe]);

  const handleCategorySelect = useCallback((category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
  }, []);

  return (
    <View className={cn("flex-1", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
      <LinearGradient
        colors={isDark ? ['#2f3628', '#262626'] : ['#e3e7dd', '#fefdfb']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          className="px-5 pt-4"
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className={cn(
                "text-sm font-medium uppercase tracking-wider",
                isDark ? "text-sage-400" : "text-sage-600"
              )}>
                Your Collection
              </Text>
              <Text className={cn(
                "text-3xl font-bold mt-1",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Recipes
              </Text>
            </View>
            <View className="flex-row items-center">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/import-recipe');
                }}
                className={cn(
                  "w-12 h-12 rounded-2xl items-center justify-center mr-2",
                  isDark ? "bg-charcoal-800" : "bg-white"
                )}
              >
                <Download size={22} color={isDark ? '#a6b594' : '#6a7d56'} strokeWidth={2} />
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/generate-recipe');
                }}
                className={cn(
                  "w-12 h-12 rounded-2xl items-center justify-center mr-2",
                  isDark ? "bg-charcoal-800" : "bg-white"
                )}
              >
                <Sparkles size={22} color={isDark ? '#f5b8a0' : '#e46d46'} strokeWidth={2} />
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/add-recipe');
                }}
                className={cn(
                  "w-12 h-12 rounded-2xl items-center justify-center",
                  isDark ? "bg-sage-600" : "bg-sage-500"
                )}
              >
                <Plus size={24} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View
          entering={FadeInDown.delay(150).springify()}
          className="px-5 mt-4"
        >
          <View className={cn(
            "flex-row items-center rounded-2xl px-4 py-3",
            isDark ? "bg-charcoal-800" : "bg-white"
          )}>
            <Search size={20} color={isDark ? '#888888' : '#6d6d6d'} />
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
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={18} color={isDark ? '#888888' : '#6d6d6d'} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Filter Tabs */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          className="mt-4"
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSavedOnly(!showSavedOnly);
              }}
              className={cn(
                "flex-row items-center px-4 py-2 rounded-full mr-2",
                showSavedOnly
                  ? isDark ? "bg-terracotta-600" : "bg-terracotta-500"
                  : isDark ? "bg-charcoal-800" : "bg-white"
              )}
            >
              <Heart
                size={14}
                color={showSavedOnly ? '#fff' : isDark ? '#f5b8a0' : '#e46d46'}
                fill={showSavedOnly ? '#fff' : 'transparent'}
              />
              <Text className={cn(
                "text-sm font-medium ml-1.5",
                showSavedOnly
                  ? "text-white"
                  : isDark ? "text-charcoal-300" : "text-charcoal-600"
              )}>
                Saved
              </Text>
            </Pressable>

            {CATEGORIES.map((category) => (
              <Pressable
                key={category.key}
                onPress={() => handleCategorySelect(category.key)}
                className={cn(
                  "px-4 py-2 rounded-full mr-2",
                  selectedCategory === category.key
                    ? isDark ? "bg-sage-600" : "bg-sage-500"
                    : isDark ? "bg-charcoal-800" : "bg-white"
                )}
              >
                <Text className={cn(
                  "text-sm font-medium",
                  selectedCategory === category.key
                    ? "text-white"
                    : isDark ? "text-charcoal-300" : "text-charcoal-600"
                )}>
                  {category.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Recipe List */}
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <RecipeCard
              recipe={item}
              onPress={() => handleRecipePress(item)}
              onToggleSave={() => handleToggleSave(item.id)}
              isDark={isDark}
              index={index}
            />
          )}
          ListEmptyComponent={() => (
            <Animated.View
              entering={FadeInDown.delay(300).springify()}
              className="items-center justify-center py-20"
            >
              <View className={cn(
                "w-20 h-20 rounded-3xl items-center justify-center mb-4",
                isDark ? "bg-charcoal-800" : "bg-cream-200"
              )}>
                <Search size={32} color={isDark ? '#6d6d6d' : '#888888'} />
              </View>
              <Text className={cn(
                "text-lg font-semibold",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                No recipes found
              </Text>
              <Text className={cn(
                "text-sm mt-1 text-center",
                isDark ? "text-charcoal-400" : "text-charcoal-500"
              )}>
                Try adjusting your filters or{'\n'}generate a new recipe
              </Text>
              <Pressable
                onPress={() => router.push('/generate-recipe')}
                className={cn(
                  "mt-6 px-6 py-3 rounded-2xl",
                  isDark ? "bg-terracotta-600" : "bg-terracotta-500"
                )}
              >
                <Text className="text-white font-semibold">Generate Recipe</Text>
              </Pressable>
            </Animated.View>
          )}
        />
      </SafeAreaView>
    </View>
  );
}
