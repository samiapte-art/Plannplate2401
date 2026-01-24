import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Recipe, Ingredient } from '@/lib/store';

interface ServingAdjustmentModalProps {
  visible: boolean;
  recipe: Recipe | null;
  currentServingOverride: number | undefined;
  onClose: () => void;
  onSave: (servingSize: number) => void;
}

export const ServingAdjustmentModal: React.FC<ServingAdjustmentModalProps> = ({
  visible,
  recipe,
  currentServingOverride,
  onClose,
  onSave,
}) => {
  const [servingSize, setServingSize] = useState<number>(
    currentServingOverride ?? recipe?.servings ?? 1
  );

  // Update serving size when modal opens with new recipe
  React.useEffect(() => {
    if (visible && recipe) {
      setServingSize(currentServingOverride ?? recipe.servings);
    }
  }, [visible, recipe, currentServingOverride]);

  const multiplier = useMemo(() => {
    if (!recipe) return 1;
    return servingSize / recipe.servings;
  }, [recipe, servingSize]);

  const adjustedIngredients = useMemo(() => {
    if (!recipe) return [];
    return recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: (parseFloat(ing.quantity) * multiplier).toFixed(2).replace(/\.?0+$/, ''),
    }));
  }, [recipe, multiplier]);

  const handleDecrement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setServingSize((prev) => Math.max(1, prev - 1));
  }, []);

  const handleIncrement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setServingSize((prev) => prev + 1);
  }, []);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(servingSize);
    onClose();
  }, [servingSize, onSave, onClose]);

  if (!recipe) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black/40">
        <View className="flex-1 justify-end">
          <View className="bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-8 max-h-4/5">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                Adjust Servings
              </Text>
              <Pressable
                onPress={onClose}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
              >
                <X size={20} color="#666" />
              </Pressable>
            </View>

            {/* Serving Size Control */}
            <View className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-6">
              <Text className="text-sm text-gray-600 dark:text-gray-400 mb-3 text-center">
                Current Servings
              </Text>
              <View className="flex-row items-center justify-center gap-4 mb-4">
                <Pressable
                  onPress={handleDecrement}
                  disabled={servingSize <= 1}
                  className={`w-12 h-12 rounded-full items-center justify-center ${
                    servingSize <= 1
                      ? 'bg-gray-200 dark:bg-gray-700'
                      : 'bg-orange-100 dark:bg-orange-900/40 active:bg-orange-200 dark:active:bg-orange-800/50'
                  }`}
                >
                  <Minus
                    size={20}
                    color={servingSize <= 1 ? '#999' : '#ea580c'}
                  />
                </Pressable>

                <View className="items-center min-w-20">
                  <Text className="text-4xl font-bold text-gray-900 dark:text-white">
                    {servingSize}
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {servingSize === 1 ? 'serving' : 'servings'}
                  </Text>
                </View>

                <Pressable
                  onPress={handleIncrement}
                  className="w-12 h-12 rounded-full items-center justify-center bg-orange-100 dark:bg-orange-900/40 active:bg-orange-200 dark:active:bg-orange-800/50"
                >
                  <Plus size={20} color="#ea580c" />
                </Pressable>
              </View>

              <View className="flex-row gap-2 mt-4">
                <Pressable
                  onPress={() => setServingSize(1)}
                  className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 active:bg-gray-50 dark:active:bg-gray-600"
                >
                  <Text className="text-xs text-gray-700 dark:text-gray-300 text-center">
                    1
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setServingSize(2)}
                  className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 active:bg-gray-50 dark:active:bg-gray-600"
                >
                  <Text className="text-xs text-gray-700 dark:text-gray-300 text-center">
                    2
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setServingSize(4)}
                  className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 active:bg-gray-50 dark:active:bg-gray-600"
                >
                  <Text className="text-xs text-gray-700 dark:text-gray-300 text-center">
                    4
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setServingSize(6)}
                  className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 active:bg-gray-50 dark:active:bg-gray-600"
                >
                  <Text className="text-xs text-gray-700 dark:text-gray-300 text-center">
                    6
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Adjusted Ingredients */}
            <View>
              <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Adjusted Ingredients
              </Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                scrollEnabled={adjustedIngredients.length > 8}
                className="max-h-64"
              >
                <View className="gap-2">
                  {adjustedIngredients.map((ing, idx) => (
                    <View
                      key={idx}
                      className="flex-row justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <Text className="flex-1 text-sm text-gray-700 dark:text-gray-300 mr-2">
                        {ing.name}
                      </Text>
                      <Text className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {ing.quantity} {ing.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-6">
              <Pressable
                onPress={onClose}
                className="flex-1 py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 active:bg-gray-50 dark:active:bg-gray-800"
              >
                <Text className="text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                className="flex-1 py-3 px-4 rounded-lg bg-orange-600 dark:bg-orange-700 active:bg-orange-700 dark:active:bg-orange-800"
              >
                <Text className="text-center text-sm font-semibold text-white">
                  Save Changes
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
