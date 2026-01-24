import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X,
  Link as LinkIcon,
  FileText,
  Sparkles,
  Instagram,
  Youtube,
  Globe,
  ChevronRight,
  AlertCircle,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { extractRecipeFromUrl, extractRecipeFromText, isUrl, detectSourceType, type ImportedRecipe } from '@/lib/recipeImport';
import { isOpenAIConfigured } from '@/lib/openai';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';

type ImportMethod = 'url' | 'text';

export default function ImportRecipeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sharedUrl?: string; sharedText?: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [importMethod, setImportMethod] = useState<ImportMethod>(params.sharedUrl ? 'url' : 'url');
  const [urlInput, setUrlInput] = useState(params.sharedUrl ?? '');
  const [textInput, setTextInput] = useState(params.sharedText ?? '');
  const [extractedRecipe, setExtractedRecipe] = useState<ImportedRecipe | null>(null);

  const isConfigured = isOpenAIConfigured();

  // URL extraction mutation
  const urlMutation = useMutation({
    mutationFn: (url: string) => extractRecipeFromUrl(url),
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExtractedRecipe(data);
      // Navigate to review screen
      router.push({
        pathname: '/import-review',
        params: { recipe: JSON.stringify(data) },
      });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('URL extraction error:', error);
    },
  });

  // Text extraction mutation
  const textMutation = useMutation({
    mutationFn: (text: string) => extractRecipeFromText(text),
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExtractedRecipe(data);
      // Navigate to review screen
      router.push({
        pathname: '/import-review',
        params: { recipe: JSON.stringify(data) },
      });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Text extraction error:', error);
    },
  });

  const isPending = urlMutation.isPending || textMutation.isPending;
  const error = urlMutation.error || textMutation.error;
  const { mutate: mutateUrl } = urlMutation;
  const { mutate: mutateText } = textMutation;

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isUrl(text)) {
          setImportMethod('url');
          setUrlInput(text);
        } else {
          setImportMethod('text');
          setTextInput(text);
        }
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
    }
  }, []);

  const handleExtract = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (importMethod === 'url') {
      const trimmedUrl = urlInput.trim();
      if (!trimmedUrl) return;
      mutateUrl(trimmedUrl);
    } else {
      const trimmedText = textInput.trim();
      if (!trimmedText) return;
      mutateText(trimmedText);
    }
  }, [importMethod, urlInput, textInput, mutateUrl, mutateText]);

  const sourceType = urlInput ? detectSourceType(urlInput) : null;

  const getSourceIcon = () => {
    switch (sourceType) {
      case 'instagram':
        return <Instagram size={20} color={isDark ? '#E1306C' : '#E1306C'} />;
      case 'youtube':
        return <Youtube size={20} color={isDark ? '#FF0000' : '#FF0000'} />;
      default:
        return <Globe size={20} color={isDark ? '#888888' : '#6d6d6d'} />;
    }
  };

  const canExtract = importMethod === 'url' ? urlInput.trim().length > 0 : textInput.trim().length > 0;

  return (
    <View className={cn("flex-1", isDark ? "bg-charcoal-900" : "bg-cream-50")}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.springify()}
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
              Import Recipe
            </Text>
          </View>
          <View className="w-10" />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* API Not Configured Warning */}
            {!isConfigured && (
              <Animated.View
                entering={FadeInDown.delay(100).springify()}
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

            {/* Import Method Selector */}
            <Animated.View
              entering={FadeInDown.delay(150).springify()}
              className="px-5 mb-6"
            >
              <Text className={cn(
                "text-base font-semibold mb-3",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Import from
              </Text>
              <View className="flex-row">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setImportMethod('url');
                  }}
                  className={cn(
                    "flex-1 flex-row items-center justify-center py-4 rounded-2xl mr-2",
                    importMethod === 'url'
                      ? isDark ? "bg-sage-600" : "bg-sage-500"
                      : isDark ? "bg-charcoal-800" : "bg-white"
                  )}
                >
                  <LinkIcon
                    size={18}
                    color={importMethod === 'url' ? '#fff' : isDark ? '#888888' : '#6d6d6d'}
                  />
                  <Text className={cn(
                    "text-sm font-medium ml-2",
                    importMethod === 'url'
                      ? "text-white"
                      : isDark ? "text-charcoal-300" : "text-charcoal-600"
                  )}>
                    URL / Link
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setImportMethod('text');
                  }}
                  className={cn(
                    "flex-1 flex-row items-center justify-center py-4 rounded-2xl",
                    importMethod === 'text'
                      ? isDark ? "bg-sage-600" : "bg-sage-500"
                      : isDark ? "bg-charcoal-800" : "bg-white"
                  )}
                >
                  <FileText
                    size={18}
                    color={importMethod === 'text' ? '#fff' : isDark ? '#888888' : '#6d6d6d'}
                  />
                  <Text className={cn(
                    "text-sm font-medium ml-2",
                    importMethod === 'text'
                      ? "text-white"
                      : isDark ? "text-charcoal-300" : "text-charcoal-600"
                  )}>
                    Text / Recipe
                  </Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Paste from Clipboard Button */}
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              className="px-5 mb-6"
            >
              <Pressable
                onPress={handlePasteFromClipboard}
                className={cn(
                  "flex-row items-center justify-center py-3 rounded-xl",
                  isDark ? "bg-charcoal-800/50" : "bg-cream-100"
                )}
              >
                <Text className={cn(
                  "text-sm font-medium",
                  isDark ? "text-sage-400" : "text-sage-600"
                )}>
                  Paste from Clipboard
                </Text>
              </Pressable>
            </Animated.View>

            {/* URL Input */}
            {importMethod === 'url' && (
              <Animated.View
                entering={FadeInDown.delay(250).springify()}
                className="px-5 mb-6"
              >
                <Text className={cn(
                  "text-base font-semibold mb-3",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Recipe URL
                </Text>
                <View className={cn(
                  "flex-row items-center rounded-2xl px-4",
                  isDark ? "bg-charcoal-800" : "bg-white"
                )}>
                  {sourceType && (
                    <View className="mr-3">
                      {getSourceIcon()}
                    </View>
                  )}
                  <TextInput
                    value={urlInput}
                    onChangeText={setUrlInput}
                    placeholder="Paste Instagram, TikTok, or website URL..."
                    placeholderTextColor={isDark ? '#6d6d6d' : '#9ca3af'}
                    className={cn(
                      "flex-1 text-base py-4",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
                <Text className={cn(
                  "text-xs mt-2",
                  isDark ? "text-charcoal-500" : "text-charcoal-400"
                )}>
                  Supports Instagram, TikTok, YouTube, Pinterest, and recipe websites
                </Text>
              </Animated.View>
            )}

            {/* Text Input */}
            {importMethod === 'text' && (
              <Animated.View
                entering={FadeInDown.delay(250).springify()}
                className="px-5 mb-6"
              >
                <Text className={cn(
                  "text-base font-semibold mb-3",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Recipe Text
                </Text>
                <View className={cn(
                  "rounded-2xl px-4",
                  isDark ? "bg-charcoal-800" : "bg-white"
                )}>
                  <TextInput
                    value={textInput}
                    onChangeText={setTextInput}
                    placeholder="Paste recipe text, ingredients list, or description..."
                    placeholderTextColor={isDark ? '#6d6d6d' : '#9ca3af'}
                    className={cn(
                      "text-base py-4",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                    style={{ minHeight: 180 }}
                  />
                </View>
                <Text className={cn(
                  "text-xs mt-2",
                  isDark ? "text-charcoal-500" : "text-charcoal-400"
                )}>
                  Paste recipe text from any source - we'll extract the details automatically
                </Text>
              </Animated.View>
            )}

            {/* Supported Sources */}
            <Animated.View
              entering={FadeInDown.delay(300).springify()}
              className="px-5 mb-6"
            >
              <Text className={cn(
                "text-sm font-medium mb-3",
                isDark ? "text-charcoal-400" : "text-charcoal-500"
              )}>
                Popular Sources
              </Text>
              <View className="flex-row flex-wrap">
                {[
                  { name: 'Instagram', color: '#E1306C' },
                  { name: 'TikTok', color: '#000000' },
                  { name: 'Pinterest', color: '#E60023' },
                  { name: 'YouTube', color: '#FF0000' },
                  { name: 'Websites', color: isDark ? '#888888' : '#6d6d6d' },
                ].map((source) => (
                  <View
                    key={source.name}
                    className={cn(
                      "flex-row items-center px-3 py-2 rounded-full mr-2 mb-2",
                      isDark ? "bg-charcoal-800" : "bg-white"
                    )}
                  >
                    <View
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: source.color }}
                    />
                    <Text className={cn(
                      "text-xs",
                      isDark ? "text-charcoal-300" : "text-charcoal-600"
                    )}>
                      {source.name}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Error State */}
            {error && (
              <Animated.View
                entering={FadeInDown.springify()}
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
                    {error?.message || 'Failed to extract recipe. Please try again.'}
                  </Text>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

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
          <Pressable
            onPress={handleExtract}
            disabled={!isConfigured || isPending || !canExtract}
            className={cn(
              "flex-row items-center justify-center py-4 rounded-2xl",
              isConfigured && !isPending && canExtract
                ? isDark ? "bg-terracotta-600" : "bg-terracotta-500"
                : isDark ? "bg-charcoal-800" : "bg-cream-200"
            )}
          >
            {isPending ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text className="text-white text-base font-semibold ml-2">
                  Extracting Recipe...
                </Text>
              </>
            ) : (
              <>
                <Sparkles
                  size={20}
                  color={isConfigured && canExtract ? '#fff' : isDark ? '#6d6d6d' : '#888888'}
                />
                <Text className={cn(
                  "text-base font-semibold ml-2",
                  isConfigured && canExtract
                    ? "text-white"
                    : isDark ? "text-charcoal-600" : "text-charcoal-400"
                )}>
                  Extract Recipe
                </Text>
                <ChevronRight
                  size={20}
                  color={isConfigured && canExtract ? '#fff' : isDark ? '#6d6d6d' : '#888888'}
                  className="ml-1"
                />
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
