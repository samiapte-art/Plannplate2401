import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingCart,
  Plus,
  Check,
  Trash2,
  Apple,
  Milk,
  Beef,
  Package,
  Snowflake,
  Croissant,
  MoreHorizontal,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Share2,
  Lock
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOutRight,
  Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMealPlanStore, type GroceryItem, type Ingredient } from '@/lib/store';
import { useIsAccountPaused } from '@/lib/subscription-store';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';

const CATEGORY_CONFIG: Record<Ingredient['category'], { icon: typeof Apple; label: string; color: string }> = {
  produce: { icon: Apple, label: 'Produce', color: '#6a7d56' },
  dairy: { icon: Milk, label: 'Dairy', color: '#3b82f6' },
  meat: { icon: Beef, label: 'Meat & Seafood', color: '#dc2626' },
  pantry: { icon: Package, label: 'Pantry', color: '#d97706' },
  frozen: { icon: Snowflake, label: 'Frozen', color: '#06b6d4' },
  bakery: { icon: Croissant, label: 'Bakery', color: '#f59e0b' },
  other: { icon: MoreHorizontal, label: 'Other', color: '#6b7280' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days: (Date | null)[] = [];

  // Add empty slots for days before the first day of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  return days;
}

interface GroceryItemRowProps {
  item: GroceryItem;
  onToggle: () => void;
  onDelete: () => void;
  isDark: boolean;
  index: number;
}

function GroceryItemRow({ item, onToggle, onDelete, isDark, index }: GroceryItemRowProps) {
  const categoryConfig = CATEGORY_CONFIG[item.category];
  const Icon = categoryConfig.icon;

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  }, [onToggle]);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  }, [onDelete]);

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 30).springify()}
      exiting={FadeOutRight.springify()}
      layout={Layout.springify()}
    >
      <Pressable
        onPress={handleToggle}
        onLongPress={handleDelete}
        delayLongPress={500}
        className={cn(
          "flex-row items-center p-4 rounded-2xl mb-2",
          isDark ? "bg-charcoal-800/50" : "bg-white",
          item.isChecked && "opacity-60"
        )}
      >
        {/* Checkbox */}
        <Pressable
          onPress={handleToggle}
          className={cn(
            "w-7 h-7 rounded-lg items-center justify-center mr-3 border-2",
            item.isChecked
              ? "bg-sage-500 border-sage-500"
              : isDark ? "border-charcoal-600" : "border-charcoal-300"
          )}
        >
          {item.isChecked && <Check size={16} color="#fff" strokeWidth={3} />}
        </Pressable>

        {/* Icon */}
        <View
          className="w-9 h-9 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: `${categoryConfig.color}20` }}
        >
          <Icon size={18} color={categoryConfig.color} />
        </View>

        {/* Item Details */}
        <View className="flex-1">
          <Text
            className={cn(
              "text-base font-medium",
              isDark ? "text-white" : "text-charcoal-900",
              item.isChecked && "line-through"
            )}
          >
            {item.name}
          </Text>
          <Text className={cn(
            "text-sm",
            isDark ? "text-charcoal-400" : "text-charcoal-500"
          )}>
            {item.quantity} {item.unit}
          </Text>
        </View>

        {/* Delete Button */}
        <Pressable
          onPress={handleDelete}
          className="p-2"
        >
          <Trash2 size={18} color={isDark ? '#6d6d6d' : '#888888'} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: Omit<GroceryItem, 'id'>) => void;
  isDark: boolean;
}

function AddItemModal({ visible, onClose, onAdd, isDark }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<Ingredient['category']>('other');

  const handleAdd = useCallback(() => {
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      quantity,
      unit: unit || 'item',
      category,
      isChecked: false,
      recipeIds: [],
    });

    setName('');
    setQuantity('1');
    setUnit('');
    setCategory('other');
    onClose();
  }, [name, quantity, unit, category, onAdd, onClose]);

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50">
      <Pressable
        onPress={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <Animated.View
        entering={FadeInDown.springify()}
        className={cn(
          "absolute bottom-0 left-0 right-0 rounded-t-3xl p-6 pb-10",
          isDark ? "bg-charcoal-800" : "bg-white"
        )}
      >
        <View className="flex-row items-center justify-between mb-6">
          <Text className={cn(
            "text-xl font-bold",
            isDark ? "text-white" : "text-charcoal-900"
          )}>
            Add Item
          </Text>
          <Pressable onPress={onClose}>
            <X size={24} color={isDark ? '#fff' : '#262626'} />
          </Pressable>
        </View>

        <View className="mb-4">
          <Text className={cn(
            "text-sm font-medium mb-2",
            isDark ? "text-charcoal-300" : "text-charcoal-600"
          )}>
            Item Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Avocado"
            placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
            className={cn(
              "px-4 py-3 rounded-xl text-base",
              isDark ? "bg-charcoal-700 text-white" : "bg-cream-100 text-charcoal-900"
            )}
          />
        </View>

        <View className="flex-row mb-4 space-x-3">
          <View className="flex-1">
            <Text className={cn(
              "text-sm font-medium mb-2",
              isDark ? "text-charcoal-300" : "text-charcoal-600"
            )}>
              Quantity
            </Text>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              className={cn(
                "px-4 py-3 rounded-xl text-base",
                isDark ? "bg-charcoal-700 text-white" : "bg-cream-100 text-charcoal-900"
              )}
            />
          </View>
          <View className="flex-1">
            <Text className={cn(
              "text-sm font-medium mb-2",
              isDark ? "text-charcoal-300" : "text-charcoal-600"
            )}>
              Unit
            </Text>
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="e.g., lbs"
              placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
              className={cn(
                "px-4 py-3 rounded-xl text-base",
                isDark ? "bg-charcoal-700 text-white" : "bg-cream-100 text-charcoal-900"
              )}
            />
          </View>
        </View>

        <View className="mb-6">
          <Text className={cn(
            "text-sm font-medium mb-2",
            isDark ? "text-charcoal-300" : "text-charcoal-600"
          )}>
            Category
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <Pressable
                key={key}
                onPress={() => setCategory(key as Ingredient['category'])}
                className={cn(
                  "px-4 py-2 rounded-full mr-2",
                  category === key
                    ? "bg-sage-500"
                    : isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}
              >
                <Text className={cn(
                  "text-sm font-medium",
                  category === key
                    ? "text-white"
                    : isDark ? "text-charcoal-300" : "text-charcoal-600"
                )}>
                  {config.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable
          onPress={handleAdd}
          className={cn(
            "py-4 rounded-2xl items-center",
            name.trim() ? "bg-sage-500" : isDark ? "bg-charcoal-700" : "bg-cream-200"
          )}
        >
          <Text className={cn(
            "text-base font-semibold",
            name.trim() ? "text-white" : isDark ? "text-charcoal-500" : "text-charcoal-400"
          )}>
            Add to List
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

interface DateRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (startDate: string, endDate: string) => void;
  isDark: boolean;
  mealSlots: Array<{ date: string; recipeId: string | null }>;
}

function DateRangePickerModal({ visible, onClose, onGenerate, isDark, mealSlots }: DateRangePickerModalProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const monthDays = useMemo(() => getMonthDays(currentYear, currentMonth), [currentYear, currentMonth]);

  const datesWithMeals = useMemo(() => {
    const dates = new Set<string>();
    mealSlots.forEach(slot => {
      if (slot.recipeId) {
        dates.add(slot.date);
      }
    });
    return dates;
  }, [mealSlots]);

  const handlePrevMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }, [currentMonth, currentYear]);

  const handleNextMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }, [currentMonth, currentYear]);

  const handleDateSelect = useCallback((date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dateKey = formatDateKey(date);

    if (!startDate || (startDate && endDate)) {
      // Start new selection
      setStartDate(dateKey);
      setEndDate(null);
    } else {
      // Complete the range
      if (dateKey < startDate) {
        setEndDate(startDate);
        setStartDate(dateKey);
      } else {
        setEndDate(dateKey);
      }
    }
  }, [startDate, endDate]);

  const isDateInRange = useCallback((date: Date) => {
    if (!startDate) return false;
    const dateKey = formatDateKey(date);
    if (!endDate) return dateKey === startDate;
    return dateKey >= startDate && dateKey <= endDate;
  }, [startDate, endDate]);

  const isStartDate = useCallback((date: Date) => {
    return startDate === formatDateKey(date);
  }, [startDate]);

  const isEndDate = useCallback((date: Date) => {
    return endDate === formatDateKey(date);
  }, [endDate]);

  const handleGenerate = useCallback(() => {
    if (startDate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onGenerate(startDate, endDate || startDate);
      setStartDate(null);
      setEndDate(null);
      onClose();
    }
  }, [startDate, endDate, onGenerate, onClose]);

  const handleClose = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
    onClose();
  }, [onClose]);

  if (!visible) return null;

  const todayKey = formatDateKey(today);

  return (
    <View className="absolute inset-0 z-50">
      <Pressable
        onPress={handleClose}
        className="absolute inset-0 bg-black/50"
      />
      <Animated.View
        entering={FadeInDown.springify()}
        className={cn(
          "absolute bottom-0 left-0 right-0 rounded-t-3xl p-5 pb-10",
          isDark ? "bg-charcoal-800" : "bg-white"
        )}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className={cn(
            "text-xl font-bold",
            isDark ? "text-white" : "text-charcoal-900"
          )}>
            Select Date Range
          </Text>
          <Pressable onPress={handleClose}>
            <X size={24} color={isDark ? '#fff' : '#262626'} />
          </Pressable>
        </View>

        {/* Instructions */}
        <Text className={cn(
          "text-sm mb-4",
          isDark ? "text-charcoal-400" : "text-charcoal-500"
        )}>
          Tap a date to start, then tap another to select a range. Dates with meals are highlighted.
        </Text>

        {/* Month Navigation */}
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            onPress={handlePrevMonth}
            className={cn(
              "w-10 h-10 rounded-full items-center justify-center",
              isDark ? "bg-charcoal-700" : "bg-cream-100"
            )}
          >
            <ChevronLeft size={20} color={isDark ? '#fff' : '#262626'} />
          </Pressable>
          <Text className={cn(
            "text-lg font-semibold",
            isDark ? "text-white" : "text-charcoal-900"
          )}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <Pressable
            onPress={handleNextMonth}
            className={cn(
              "w-10 h-10 rounded-full items-center justify-center",
              isDark ? "bg-charcoal-700" : "bg-cream-100"
            )}
          >
            <ChevronRight size={20} color={isDark ? '#fff' : '#262626'} />
          </Pressable>
        </View>

        {/* Day Headers */}
        <View className="flex-row mb-2">
          {DAYS.map((day) => (
            <View key={day} className="flex-1 items-center">
              <Text className={cn(
                "text-xs font-medium",
                isDark ? "text-charcoal-500" : "text-charcoal-400"
              )}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View className="flex-row flex-wrap mb-4">
          {monthDays.map((date, index) => {
            if (!date) {
              return <View key={`empty-${index}`} className="w-[14.28%] h-10" />;
            }

            const dateKey = formatDateKey(date);
            const isToday = dateKey === todayKey;
            const inRange = isDateInRange(date);
            const isStart = isStartDate(date);
            const isEnd = isEndDate(date);
            const hasMeal = datesWithMeals.has(dateKey);

            return (
              <Pressable
                key={dateKey}
                onPress={() => handleDateSelect(date)}
                className={cn(
                  "w-[14.28%] h-10 items-center justify-center",
                  inRange && !isStart && !isEnd && (isDark ? "bg-sage-900/50" : "bg-sage-100"),
                  isStart && "rounded-l-full",
                  isEnd && "rounded-r-full",
                  (isStart || isEnd) && (isDark ? "bg-sage-600" : "bg-sage-500")
                )}
              >
                <View className={cn(
                  "w-8 h-8 rounded-full items-center justify-center",
                  isToday && !inRange && "border-2 border-sage-500"
                )}>
                  <Text className={cn(
                    "text-sm font-medium",
                    (isStart || isEnd) ? "text-white" : isDark ? "text-white" : "text-charcoal-900"
                  )}>
                    {date.getDate()}
                  </Text>
                  {hasMeal && !isStart && !isEnd && (
                    <View className={cn(
                      "absolute bottom-0 w-1.5 h-1.5 rounded-full",
                      isDark ? "bg-terracotta-400" : "bg-terracotta-500"
                    )} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Selected Range Display */}
        {startDate && (
          <View className={cn(
            "p-3 rounded-xl mb-4",
            isDark ? "bg-charcoal-700" : "bg-cream-100"
          )}>
            <Text className={cn(
              "text-sm text-center",
              isDark ? "text-charcoal-300" : "text-charcoal-600"
            )}>
              {endDate
                ? `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (tap another date for range)`
              }
            </Text>
          </View>
        )}

        {/* Generate Button */}
        <Pressable
          onPress={handleGenerate}
          disabled={!startDate}
          className={cn(
            "py-4 rounded-2xl items-center",
            startDate ? (isDark ? "bg-sage-600" : "bg-sage-500") : (isDark ? "bg-charcoal-700" : "bg-cream-200")
          )}
        >
          <Text className={cn(
            "text-base font-semibold",
            startDate ? "text-white" : isDark ? "text-charcoal-500" : "text-charcoal-400"
          )}>
            Generate Grocery List
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function GroceryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isPaused = useIsAccountPaused();

  const groceryItems = useMealPlanStore((s) => s.groceryItems);
  const toggleGroceryItem = useMealPlanStore((s) => s.toggleGroceryItem);
  const addGroceryItem = useMealPlanStore((s) => s.addGroceryItem);
  const removeGroceryItem = useMealPlanStore((s) => s.removeGroceryItem);
  const clearCheckedItems = useMealPlanStore((s) => s.clearCheckedItems);
  const generateGroceryList = useMealPlanStore((s) => s.generateGroceryList);
  const mealSlots = useMealPlanStore((s) => s.mealSlots);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, GroceryItem[]> = {};

    groceryItems.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });

    // Sort items within each category: unchecked first
    Object.keys(groups).forEach((category) => {
      groups[category].sort((a, b) => {
        if (a.isChecked === b.isChecked) return 0;
        return a.isChecked ? 1 : -1;
      });
    });

    return groups;
  }, [groceryItems]);

  const stats = useMemo(() => {
    const total = groceryItems.length;
    const checked = groceryItems.filter((i) => i.isChecked).length;
    return { total, checked, remaining: total - checked };
  }, [groceryItems]);

  const handleGenerateFromMealPlan = useCallback((startDate: string, endDate: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    generateGroceryList(startDate, endDate);
  }, [generateGroceryList]);

  const handleClearChecked = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearCheckedItems();
  }, [clearCheckedItems]);

  // Format grocery list for sharing
  const formatGroceryListForShare = useCallback(() => {
    if (groceryItems.length === 0) return '';

    let text = '🛒 *Grocery List*\n\n';

    // Group by category
    const grouped: Record<string, GroceryItem[]> = {};
    groceryItems.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    // Format each category
    Object.entries(grouped).forEach(([category, items]) => {
      const config = CATEGORY_CONFIG[category as Ingredient['category']];
      text += `*${config.label}*\n`;
      items.forEach((item) => {
        const checkbox = item.isChecked ? '✅' : '⬜';
        text += `${checkbox} ${item.quantity} ${item.unit} ${item.name}\n`;
      });
      text += '\n';
    });

    return text.trim();
  }, [groceryItems]);

  const handleShareWhatsApp = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const text = formatGroceryListForShare();
    if (!text) return;

    try {
      // Use the native share sheet - user can select WhatsApp from there
      await Share.share({
        message: text,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [formatGroceryListForShare]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const text = formatGroceryListForShare();
    if (!text) return;

    try {
      await Share.share({
        message: text,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }, [formatGroceryListForShare]);

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
            className="px-5 pt-4"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className={cn(
                  "text-sm font-medium uppercase tracking-wider",
                  isDark ? "text-sage-400" : "text-sage-600"
                )}>
                  Shopping
                </Text>
                <Text className={cn(
                  "text-3xl font-bold mt-1",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Grocery List
                </Text>
              </View>
              <View className="flex-row items-center">
                <Pressable
                  onPress={handleShareWhatsApp}
                  className={cn(
                    "w-12 h-12 rounded-2xl items-center justify-center mr-2",
                    isDark ? "bg-charcoal-800" : "bg-white",
                    groceryItems.length === 0 && "opacity-40"
                  )}
                  disabled={groceryItems.length === 0}
                >
                  <Share2 size={22} color={isDark ? '#a6b594' : '#6a7d56'} strokeWidth={2} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowAddModal(true);
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

          {/* Stats Card */}
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            className="px-5 mt-4"
          >
            <View className={cn(
              "rounded-2xl p-4",
              isDark ? "bg-charcoal-800/50" : "bg-white"
            )}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className={cn(
                    "text-sm",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    {stats.remaining} items remaining
                  </Text>
                  <View className="flex-row items-baseline mt-1">
                    <Text className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      {stats.checked}
                    </Text>
                    <Text className={cn(
                      "text-lg",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      /{stats.total}
                    </Text>
                  </View>
                </View>

                {/* Progress Circle */}
                <View className="relative w-16 h-16">
                  <View className={cn(
                    "absolute inset-0 rounded-full border-4",
                    isDark ? "border-charcoal-700" : "border-cream-200"
                  )} />
                  <View
                    className="absolute inset-0 rounded-full border-4 border-sage-500"
                    style={{
                      borderTopColor: 'transparent',
                      borderRightColor: stats.total > 0 && stats.checked / stats.total >= 0.25 ? '#6a7d56' : 'transparent',
                      borderBottomColor: stats.total > 0 && stats.checked / stats.total >= 0.5 ? '#6a7d56' : 'transparent',
                      borderLeftColor: stats.total > 0 && stats.checked / stats.total >= 0.75 ? '#6a7d56' : 'transparent',
                      transform: [{ rotate: '-45deg' }],
                    }}
                  />
                  <View className="absolute inset-0 items-center justify-center">
                    <ShoppingCart size={20} color={isDark ? '#a6b594' : '#6a7d56'} />
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            className="px-5 mt-4 flex-row space-x-3"
          >
            <Pressable
              onPress={() => {
                if (isPaused) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowDatePicker(true);
              }}
              className={cn(
                "flex-1 flex-row items-center justify-center py-3 rounded-xl",
                isPaused
                  ? isDark ? "bg-amber-900/20" : "bg-amber-50"
                  : isDark ? "bg-terracotta-800/30" : "bg-terracotta-50"
              )}
            >
              {isPaused ? (
                <Lock size={16} color={isDark ? '#fbbf24' : '#d97706'} />
              ) : (
                <Calendar size={16} color={isDark ? '#f5b8a0' : '#e46d46'} />
              )}
              <Text className={cn(
                "text-sm font-semibold ml-2",
                isPaused
                  ? isDark ? "text-amber-400" : "text-amber-700"
                  : isDark ? "text-terracotta-300" : "text-terracotta-600"
              )}>
                {isPaused ? 'Paused' : 'From Meal Plan'}
              </Text>
            </Pressable>
            {stats.checked > 0 && (
              <Pressable
                onPress={handleClearChecked}
                className={cn(
                  "flex-row items-center justify-center py-3 px-4 rounded-xl",
                  isDark ? "bg-charcoal-800" : "bg-cream-200"
                )}
              >
                <Trash2 size={16} color={isDark ? '#888888' : '#6d6d6d'} />
                <Text className={cn(
                  "text-sm font-semibold ml-2",
                  isDark ? "text-charcoal-300" : "text-charcoal-600"
                )}>
                  Clear Done
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Grocery Items by Category */}
          {groceryItems.length > 0 ? (
            <View className="px-5 mt-6">
              {Object.entries(groupedItems).map(([category, items], categoryIndex) => {
                const config = CATEGORY_CONFIG[category as Ingredient['category']];
                const Icon = config.icon;

                return (
                  <Animated.View
                    key={category}
                    entering={FadeInDown.delay(250 + categoryIndex * 50).springify()}
                    className="mb-6"
                  >
                    <View className="flex-row items-center mb-3">
                      <View
                        className="w-8 h-8 rounded-lg items-center justify-center mr-2"
                        style={{ backgroundColor: `${config.color}20` }}
                      >
                        <Icon size={16} color={config.color} />
                      </View>
                      <Text className={cn(
                        "text-base font-semibold",
                        isDark ? "text-white" : "text-charcoal-900"
                      )}>
                        {config.label}
                      </Text>
                      <Text className={cn(
                        "text-sm ml-2",
                        isDark ? "text-charcoal-500" : "text-charcoal-400"
                      )}>
                        ({items.length})
                      </Text>
                    </View>

                    {items.map((item, index) => (
                      <GroceryItemRow
                        key={item.id}
                        item={item}
                        onToggle={() => toggleGroceryItem(item.id)}
                        onDelete={() => removeGroceryItem(item.id)}
                        isDark={isDark}
                        index={index}
                      />
                    ))}
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <Animated.View
              entering={FadeInDown.delay(300).springify()}
              className="items-center justify-center py-20 px-5"
            >
              <View className={cn(
                "w-20 h-20 rounded-3xl items-center justify-center mb-4",
                isDark ? "bg-charcoal-800" : "bg-cream-200"
              )}>
                <ShoppingCart size={32} color={isDark ? '#6d6d6d' : '#888888'} />
              </View>
              <Text className={cn(
                "text-lg font-semibold",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Your list is empty
              </Text>
              <Text className={cn(
                "text-sm mt-1 text-center",
                isDark ? "text-charcoal-400" : "text-charcoal-500"
              )}>
                Add items manually{isPaused ? '' : ' or generate\nfrom your meal plan'}
              </Text>
              {!isPaused && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowDatePicker(true);
                  }}
                  className={cn(
                    "mt-6 flex-row items-center px-6 py-3 rounded-2xl",
                    isDark ? "bg-sage-600" : "bg-sage-500"
                  )}
                >
                  <Calendar size={18} color="#fff" />
                  <Text className="text-white font-semibold ml-2">Select Dates</Text>
                </Pressable>
              )}
              {isPaused && (
                <View className={cn(
                  "mt-6 flex-row items-center px-6 py-3 rounded-2xl",
                  isDark ? "bg-amber-900/30" : "bg-amber-100"
                )}>
                  <Lock size={18} color={isDark ? '#fbbf24' : '#d97706'} />
                  <Text className={cn(
                    "font-semibold ml-2",
                    isDark ? "text-amber-400" : "text-amber-700"
                  )}>
                    Generation Paused
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add Item Modal */}
      <AddItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addGroceryItem}
        isDark={isDark}
      />

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onGenerate={handleGenerateFromMealPlan}
        isDark={isDark}
        mealSlots={mealSlots}
      />
    </View>
  );
}
