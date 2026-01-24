import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { X, Plus, Clock, Users, Flame, ChefHat, Trash2, Mic, MicOff, Sparkles, Upload, FileText, Camera, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { useMealPlanStore, type Recipe, type Ingredient } from '@/lib/store';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { isOpenAIConfigured } from '@/lib/openai';

// Get OpenAI API key fresh each time
function getOpenAIKey(): string {
  return process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY || '';
}

const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
  'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=400',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
];

interface IngredientInput {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: Ingredient['category'];
}

interface ParsedRecipe {
  name: string;
  description: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  calories?: number;
  ingredients: Array<{ name: string; quantity: string; unit: string; category: string }>;
  instructions: string[];
  tags: string[];
}

async function parseRecipeFromImage(imageUri: string): Promise<ParsedRecipe> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in the API tab.');
  }

  // Read the image as base64
  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Determine mime type from uri
  const isJpeg = imageUri.toLowerCase().includes('.jpg') || imageUri.toLowerCase().includes('.jpeg');
  const mimeType = isJpeg ? 'image/jpeg' : 'image/png';

  console.log('[AddRecipe] Parsing recipe from image...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a recipe parser. Extract recipe information from images (can be a photo of a recipe card, screenshot of a recipe, photo of food with visible recipe text, etc.) and return a JSON object with this exact structure:
{
  "name": "Recipe Name",
  "description": "Brief description",
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "calories": 400,
  "ingredients": [
    {"name": "ingredient", "quantity": "1", "unit": "cup", "category": "produce|dairy|meat|pantry|frozen|bakery|other"}
  ],
  "instructions": ["Step 1", "Step 2"],
  "tags": ["tag1", "tag2"]
}
Only output valid JSON, no markdown or explanations. If information is missing, make reasonable estimates based on what you can see.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the recipe information from this image and return it as structured JSON.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[AddRecipe] Image parse error:', response.status, errorData);
    throw new Error(errorData?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';

  // Clean and parse JSON
  let cleanedText = content.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }

  console.log('[AddRecipe] Recipe parsed from image successfully');
  return JSON.parse(cleanedText.trim());
}

async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in the API tab.');
  }

  const fileInfo = await FileSystem.getInfoAsync(audioUri);
  if (!fileInfo.exists) {
    throw new Error('Audio file not found');
  }

  console.log('[AddRecipe] Transcribing audio...');

  // Create form data for Whisper API
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as unknown as Blob);
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[AddRecipe] Transcription error:', response.status, errorData);
    throw new Error(errorData?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[AddRecipe] Audio transcribed successfully');
  return data?.text ?? '';
}

async function parseRecipeFromText(text: string): Promise<ParsedRecipe> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in the API tab.');
  }

  console.log('[AddRecipe] Parsing recipe from text...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a recipe parser. Extract recipe information from spoken text and return a JSON object with this exact structure:
{
  "name": "Recipe Name",
  "description": "Brief description",
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "calories": 400,
  "ingredients": [
    {"name": "ingredient", "quantity": "1", "unit": "cup", "category": "produce|dairy|meat|pantry|frozen|bakery|other"}
  ],
  "instructions": ["Step 1", "Step 2"],
  "tags": ["tag1", "tag2"]
}
Only output valid JSON, no markdown or explanations. If information is missing, make reasonable estimates.`,
        },
        {
          role: 'user',
          content: `Parse this spoken recipe into structured JSON: "${text}"`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[AddRecipe] Text parse error:', response.status, errorData);
    throw new Error(errorData?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';

  // Clean and parse JSON
  let cleanedText = content.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }

  console.log('[AddRecipe] Recipe parsed from text successfully');
  return JSON.parse(cleanedText.trim());
}

export default function AddRecipeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const addRecipe = useMealPlanStore((s) => s.addRecipe);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('15');
  const [cookTime, setCookTime] = useState('30');
  const [servings, setServings] = useState('4');
  const [calories, setCalories] = useState('');
  const [tags, setTags] = useState('');
  const [ingredients, setIngredients] = useState<IngredientInput[]>([
    { id: '1', name: '', quantity: '', unit: '', category: 'produce' },
  ]);
  const [instructions, setInstructions] = useState<string[]>(['']);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [isUploadProcessing, setIsUploadProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [wasAutoFilled, setWasAutoFilled] = useState(false); // Track if form was auto-filled via voice/upload

  const recordingRef = useRef<Audio.Recording | null>(null);

  // Animation for recording indicator
  const pulseScale = useSharedValue(1);
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startRecording = useCallback(async () => {
    try {
      setVoiceError(null);

      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setVoiceError('Microphone permission is required');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsRecording(true);
      setShowVoiceModal(true);

      // Start pulse animation
      pulseScale.value = withRepeat(
        withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
    } catch (error) {
      console.error('Failed to start recording:', error);
      setVoiceError('Failed to start recording');
      setIsRecording(false);
    }
  }, [pulseScale]);

  const stopRecording = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsRecording(false);
      pulseScale.value = 1;

      const recording = recordingRef.current;
      if (!recording) {
        setVoiceError('No recording found');
        return;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        setVoiceError('No recording found');
        return;
      }

      setIsProcessing(true);

      // Transcribe audio
      const transcription = await transcribeAudio(uri);
      setTranscribedText(transcription);

      // Parse recipe from transcription
      const parsedRecipe = await parseRecipeFromText(transcription);

      // Fill in the form with parsed data
      setName(parsedRecipe.name || '');
      setDescription(parsedRecipe.description || '');
      setPrepTime(parsedRecipe.prepTime?.toString() || '15');
      setCookTime(parsedRecipe.cookTime?.toString() || '30');
      setServings(parsedRecipe.servings?.toString() || '4');
      setCalories(parsedRecipe.calories?.toString() || '');
      setTags(parsedRecipe.tags?.join(', ') || '');

      if (parsedRecipe.ingredients && parsedRecipe.ingredients.length > 0) {
        setIngredients(
          parsedRecipe.ingredients.map((ing, index) => ({
            id: `voice-${index}`,
            name: ing.name || '',
            quantity: ing.quantity || '',
            unit: ing.unit || '',
            category: (ing.category as Ingredient['category']) || 'produce',
          }))
        );
      }

      if (parsedRecipe.instructions && parsedRecipe.instructions.length > 0) {
        setInstructions(parsedRecipe.instructions);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowVoiceModal(false);
    } catch (error) {
      console.error('Failed to process recording:', error);
      setVoiceError('Failed to process your voice. Please try again or type manually.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  }, [pulseScale]);

  const cancelRecording = useCallback(async () => {
    try {
      const recording = recordingRef.current;
      if (recording) {
        await recording.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      setIsRecording(false);
      setIsProcessing(false);
      setShowVoiceModal(false);
      setTranscribedText('');
      setVoiceError(null);
      pulseScale.value = 1;
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }, [pulseScale]);

  // Helper to fill form with parsed recipe data
  const fillFormWithRecipe = useCallback((parsedRecipe: ParsedRecipe) => {
    setName(parsedRecipe.name || '');
    setDescription(parsedRecipe.description || '');
    setPrepTime(parsedRecipe.prepTime?.toString() || '15');
    setCookTime(parsedRecipe.cookTime?.toString() || '30');
    setServings(parsedRecipe.servings?.toString() || '4');
    setCalories(parsedRecipe.calories?.toString() || '');
    setTags(parsedRecipe.tags?.join(', ') || '');
    setWasAutoFilled(true); // Mark as auto-filled via voice/upload

    if (parsedRecipe.ingredients && parsedRecipe.ingredients.length > 0) {
      setIngredients(
        parsedRecipe.ingredients.map((ing, index) => ({
          id: `upload-${index}`,
          name: ing.name || '',
          quantity: ing.quantity || '',
          unit: ing.unit || '',
          category: (ing.category as Ingredient['category']) || 'produce',
        }))
      );
    }

    if (parsedRecipe.instructions && parsedRecipe.instructions.length > 0) {
      setInstructions(parsedRecipe.instructions);
    }
  }, []);

  // Handle text upload processing
  const handleProcessText = useCallback(async () => {
    if (!uploadText.trim()) {
      setUploadError('Please paste some recipe text');
      return;
    }

    try {
      setUploadError(null);
      setIsUploadProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const parsedRecipe = await parseRecipeFromText(uploadText);
      fillFormWithRecipe(parsedRecipe);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowUploadModal(false);
      setUploadText('');
    } catch (error) {
      console.error('Failed to process text:', error);
      setUploadError('Failed to parse recipe from text. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploadProcessing(false);
    }
  }, [uploadText, fillFormWithRecipe]);

  // Handle image upload
  const handleImageUpload = useCallback(async () => {
    try {
      setUploadError(null);

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setUploadError('Photo library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsUploadProcessing(true);

      const parsedRecipe = await parseRecipeFromImage(result.assets[0].uri);
      fillFormWithRecipe(parsedRecipe);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowUploadModal(false);
      setUploadText('');
    } catch (error) {
      console.error('Failed to process image:', error);
      setUploadError('Failed to parse recipe from image. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploadProcessing(false);
    }
  }, [fillFormWithRecipe]);

  // Handle camera capture
  const handleCameraCapture = useCallback(async () => {
    try {
      setUploadError(null);

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        setUploadError('Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsUploadProcessing(true);

      const parsedRecipe = await parseRecipeFromImage(result.assets[0].uri);
      fillFormWithRecipe(parsedRecipe);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowUploadModal(false);
      setUploadText('');
    } catch (error) {
      console.error('Failed to process camera image:', error);
      setUploadError('Failed to parse recipe from image. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploadProcessing(false);
    }
  }, [fillFormWithRecipe]);

  const cancelUpload = useCallback(() => {
    setShowUploadModal(false);
    setUploadText('');
    setUploadError(null);
    setIsUploadProcessing(false);
  }, []);

  const addIngredient = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', quantity: '', unit: '', category: 'produce' },
    ]);
  }, []);

  const removeIngredient = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
  }, []);

  const updateIngredient = useCallback((id: string, field: keyof IngredientInput, value: string) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing))
    );
  }, []);

  const addInstruction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInstructions((prev) => [...prev, '']);
  }, []);

  const removeInstruction = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateInstruction = useCallback((index: number, value: string) => {
    setInstructions((prev) => prev.map((inst, i) => (i === index ? value : inst)));
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const validIngredients = ingredients
      .filter((ing) => ing.name.trim())
      .map((ing, index) => ({
        id: `ing-${index}`,
        name: ing.name.trim(),
        quantity: ing.quantity.trim() || '1',
        unit: ing.unit.trim() || 'piece',
        category: ing.category,
      }));

    const validInstructions = instructions.filter((inst) => inst.trim());

    const tagList = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const recipe: Recipe = {
      id: '',
      name: name.trim(),
      description: description.trim() || `A delicious ${name.trim()} recipe`,
      imageUrl: STOCK_IMAGES[Math.floor(Math.random() * STOCK_IMAGES.length)],
      prepTime: parseInt(prepTime) || 15,
      cookTime: parseInt(cookTime) || 30,
      servings: parseInt(servings) || 4,
      calories: calories ? parseInt(calories) : undefined,
      ingredients: validIngredients,
      instructions: validInstructions.length > 0 ? validInstructions : ['Prepare and enjoy!'],
      tags: tagList.length > 0 ? tagList : ['homemade'],
      isAIGenerated: false,
      isImported: wasAutoFilled, // true if filled via voice/upload, false if manually typed
      isSaved: false,
      createdAt: new Date().toISOString(),
    };

    addRecipe(recipe);
    router.back();
  }, [name, description, prepTime, cookTime, servings, calories, ingredients, instructions, tags, wasAutoFilled, addRecipe, router]);

  const isApiConfigured = isOpenAIConfigured();

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
            <ChefHat size={20} color={isDark ? '#a6b594' : '#6a7d56'} />
            <Text className={cn(
              "text-lg font-bold ml-2",
              isDark ? "text-white" : "text-charcoal-900"
            )}>
              Add Recipe
            </Text>
          </View>
          <Pressable
            onPress={handleSave}
            disabled={!name.trim()}
            className={cn(
              "px-4 py-2 rounded-full",
              name.trim()
                ? isDark ? "bg-sage-600" : "bg-sage-500"
                : isDark ? "bg-charcoal-700" : "bg-cream-200"
            )}
          >
            <Text className={cn(
              "font-semibold",
              name.trim() ? "text-white" : isDark ? "text-charcoal-500" : "text-charcoal-400"
            )}>
              Save
            </Text>
          </Pressable>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Voice & Upload Input Buttons */}
            <Animated.View
              entering={FadeInDown.delay(125).springify()}
              className="px-5 mb-6"
            >
              <View className="flex-row gap-3">
                {/* Voice Input Button */}
                <Pressable
                  onPress={startRecording}
                  disabled={!isApiConfigured}
                  className={cn(
                    "flex-1 flex-row items-center justify-center py-4 rounded-2xl",
                    isApiConfigured
                      ? isDark ? "bg-terracotta-600" : "bg-terracotta-500"
                      : isDark ? "bg-charcoal-800" : "bg-cream-200"
                  )}
                >
                  <Mic size={20} color={isApiConfigured ? '#fff' : isDark ? '#6d6d6d' : '#888888'} />
                  <Text className={cn(
                    "text-sm font-semibold ml-2",
                    isApiConfigured ? "text-white" : isDark ? "text-charcoal-500" : "text-charcoal-400"
                  )}>
                    Speak Recipe
                  </Text>
                </Pressable>

                {/* Upload Button */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowUploadModal(true);
                  }}
                  disabled={!isApiConfigured}
                  className={cn(
                    "flex-1 flex-row items-center justify-center py-4 rounded-2xl",
                    isApiConfigured
                      ? isDark ? "bg-sage-600" : "bg-sage-500"
                      : isDark ? "bg-charcoal-800" : "bg-cream-200"
                  )}
                >
                  <Upload size={20} color={isApiConfigured ? '#fff' : isDark ? '#6d6d6d' : '#888888'} />
                  <Text className={cn(
                    "text-sm font-semibold ml-2",
                    isApiConfigured ? "text-white" : isDark ? "text-charcoal-500" : "text-charcoal-400"
                  )}>
                    Upload Recipe
                  </Text>
                </Pressable>
              </View>
              {isApiConfigured && (
                <Text className={cn(
                  "text-xs text-center mt-2",
                  isDark ? "text-charcoal-500" : "text-charcoal-400"
                )}>
                  Speak, paste text, or upload an image - we'll fill in the details!
                </Text>
              )}
              {!isApiConfigured && (
                <Text className={cn(
                  "text-xs text-center mt-2",
                  isDark ? "text-charcoal-500" : "text-charcoal-400"
                )}>
                  Supabase connection required for voice/upload features
                </Text>
              )}
            </Animated.View>

            {/* Divider */}
            <View className="px-5 mb-6">
              <View className="flex-row items-center">
                <View className={cn("flex-1 h-px", isDark ? "bg-charcoal-700" : "bg-cream-300")} />
                <Text className={cn("mx-4 text-sm", isDark ? "text-charcoal-500" : "text-charcoal-400")}>
                  or type manually
                </Text>
                <View className={cn("flex-1 h-px", isDark ? "bg-charcoal-700" : "bg-cream-300")} />
              </View>
            </View>

            {/* Basic Info */}
            <Animated.View
              entering={FadeInDown.delay(150).springify()}
              className="px-5 mb-6"
            >
              <Text className={cn(
                "text-base font-semibold mb-3",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Recipe Name *
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Grandma's Apple Pie"
                placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
                className={cn(
                  "px-4 py-3 rounded-2xl text-base",
                  isDark ? "bg-charcoal-800 text-white" : "bg-white text-charcoal-900"
                )}
              />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(175).springify()}
              className="px-5 mb-6"
            >
              <Text className={cn(
                "text-base font-semibold mb-3",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="A brief description of your recipe"
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

            {/* Time and Servings */}
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              className="px-5 mb-6"
            >
              <Text className={cn(
                "text-base font-semibold mb-3",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Details
              </Text>
              <View className="flex-row">
                <View className={cn(
                  "flex-1 rounded-2xl p-4 mr-2",
                  isDark ? "bg-charcoal-800" : "bg-white"
                )}>
                  <View className="flex-row items-center mb-2">
                    <Clock size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                    <Text className={cn(
                      "text-xs ml-1.5",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Prep (min)
                    </Text>
                  </View>
                  <TextInput
                    value={prepTime}
                    onChangeText={setPrepTime}
                    keyboardType="numeric"
                    className={cn(
                      "text-xl font-bold",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}
                  />
                </View>
                <View className={cn(
                  "flex-1 rounded-2xl p-4 mr-2",
                  isDark ? "bg-charcoal-800" : "bg-white"
                )}>
                  <View className="flex-row items-center mb-2">
                    <Clock size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                    <Text className={cn(
                      "text-xs ml-1.5",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Cook (min)
                    </Text>
                  </View>
                  <TextInput
                    value={cookTime}
                    onChangeText={setCookTime}
                    keyboardType="numeric"
                    className={cn(
                      "text-xl font-bold",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}
                  />
                </View>
                <View className={cn(
                  "flex-1 rounded-2xl p-4",
                  isDark ? "bg-charcoal-800" : "bg-white"
                )}>
                  <View className="flex-row items-center mb-2">
                    <Users size={16} color={isDark ? '#a6b594' : '#6a7d56'} />
                    <Text className={cn(
                      "text-xs ml-1.5",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Servings
                    </Text>
                  </View>
                  <TextInput
                    value={servings}
                    onChangeText={setServings}
                    keyboardType="numeric"
                    className={cn(
                      "text-xl font-bold",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}
                  />
                </View>
              </View>

              <View className={cn(
                "rounded-2xl p-4 mt-3",
                isDark ? "bg-charcoal-800" : "bg-white"
              )}>
                <View className="flex-row items-center mb-2">
                  <Flame size={16} color={isDark ? '#f5b8a0' : '#e46d46'} />
                  <Text className={cn(
                    "text-xs ml-1.5",
                    isDark ? "text-charcoal-400" : "text-charcoal-500"
                  )}>
                    Calories (optional)
                  </Text>
                </View>
                <TextInput
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="e.g., 350"
                  placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
                  keyboardType="numeric"
                  className={cn(
                    "text-lg font-semibold",
                    isDark ? "text-white" : "text-charcoal-900"
                  )}
                />
              </View>
            </Animated.View>

            {/* Ingredients */}
            <Animated.View
              entering={FadeInDown.delay(225).springify()}
              className="px-5 mb-6"
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className={cn(
                  "text-base font-semibold",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Ingredients
                </Text>
                <Pressable
                  onPress={addIngredient}
                  className={cn(
                    "flex-row items-center px-3 py-1.5 rounded-full",
                    isDark ? "bg-sage-800" : "bg-sage-100"
                  )}
                >
                  <Plus size={14} color={isDark ? '#a6b594' : '#6a7d56'} />
                  <Text className={cn(
                    "text-sm font-medium ml-1",
                    isDark ? "text-sage-300" : "text-sage-700"
                  )}>
                    Add
                  </Text>
                </Pressable>
              </View>

              {ingredients.map((ing, index) => (
                <View
                  key={ing.id}
                  className={cn(
                    "rounded-2xl p-4 mb-3",
                    isDark ? "bg-charcoal-800" : "bg-white"
                  )}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className={cn(
                      "text-xs font-medium",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Ingredient {index + 1}
                    </Text>
                    {ingredients.length > 1 && (
                      <Pressable onPress={() => removeIngredient(ing.id)}>
                        <Trash2 size={16} color="#dc2626" />
                      </Pressable>
                    )}
                  </View>
                  <TextInput
                    value={ing.name}
                    onChangeText={(v) => updateIngredient(ing.id, 'name', v)}
                    placeholder="Ingredient name"
                    placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
                    className={cn(
                      "text-base mb-2",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}
                  />
                  <View className="flex-row">
                    <TextInput
                      value={ing.quantity}
                      onChangeText={(v) => updateIngredient(ing.id, 'quantity', v)}
                      placeholder="Qty"
                      placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
                      className={cn(
                        "flex-1 text-sm mr-2 px-3 py-2 rounded-xl",
                        isDark ? "bg-charcoal-700 text-white" : "bg-cream-100 text-charcoal-900"
                      )}
                    />
                    <TextInput
                      value={ing.unit}
                      onChangeText={(v) => updateIngredient(ing.id, 'unit', v)}
                      placeholder="Unit (cup, tbsp)"
                      placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
                      className={cn(
                        "flex-2 text-sm px-3 py-2 rounded-xl",
                        isDark ? "bg-charcoal-700 text-white" : "bg-cream-100 text-charcoal-900"
                      )}
                      style={{ flex: 2 }}
                    />
                  </View>
                </View>
              ))}
            </Animated.View>

            {/* Instructions */}
            <Animated.View
              entering={FadeInDown.delay(250).springify()}
              className="px-5 mb-6"
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className={cn(
                  "text-base font-semibold",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Instructions
                </Text>
                <Pressable
                  onPress={addInstruction}
                  className={cn(
                    "flex-row items-center px-3 py-1.5 rounded-full",
                    isDark ? "bg-sage-800" : "bg-sage-100"
                  )}
                >
                  <Plus size={14} color={isDark ? '#a6b594' : '#6a7d56'} />
                  <Text className={cn(
                    "text-sm font-medium ml-1",
                    isDark ? "text-sage-300" : "text-sage-700"
                  )}>
                    Add Step
                  </Text>
                </Pressable>
              </View>

              {instructions.map((inst, index) => (
                <View
                  key={index}
                  className={cn(
                    "flex-row items-start rounded-2xl p-4 mb-3",
                    isDark ? "bg-charcoal-800" : "bg-white"
                  )}
                >
                  <View className={cn(
                    "w-7 h-7 rounded-full items-center justify-center mr-3 mt-1",
                    isDark ? "bg-sage-800" : "bg-sage-100"
                  )}>
                    <Text className={cn(
                      "text-sm font-bold",
                      isDark ? "text-sage-300" : "text-sage-700"
                    )}>
                      {index + 1}
                    </Text>
                  </View>
                  <TextInput
                    value={inst}
                    onChangeText={(v) => updateInstruction(index, v)}
                    placeholder={`Step ${index + 1}...`}
                    placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
                    multiline
                    className={cn(
                      "flex-1 text-base",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}
                  />
                  {instructions.length > 1 && (
                    <Pressable onPress={() => removeInstruction(index)} className="ml-2 mt-1">
                      <Trash2 size={16} color="#dc2626" />
                    </Pressable>
                  )}
                </View>
              ))}
            </Animated.View>

            {/* Tags */}
            <Animated.View
              entering={FadeInDown.delay(275).springify()}
              className="px-5 mb-6"
            >
              <Text className={cn(
                "text-base font-semibold mb-3",
                isDark ? "text-white" : "text-charcoal-900"
              )}>
                Tags (comma separated)
              </Text>
              <TextInput
                value={tags}
                onChangeText={setTags}
                placeholder="e.g., healthy, quick, vegetarian"
                placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
                className={cn(
                  "px-4 py-3 rounded-2xl text-base",
                  isDark ? "bg-charcoal-800 text-white" : "bg-white text-charcoal-900"
                )}
              />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Voice Recording Modal */}
      <Modal
        visible={showVoiceModal}
        transparent
        animationType="fade"
        onRequestClose={cancelRecording}
      >
        <View className="flex-1 bg-black/70 items-center justify-center px-8">
          <View className={cn(
            "w-full rounded-3xl p-6 items-center",
            isDark ? "bg-charcoal-800" : "bg-white"
          )}>
            {isRecording ? (
              <>
                <Animated.View
                  style={[
                    pulseAnimatedStyle,
                    {
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      backgroundColor: isDark ? '#e46d46' : '#e46d46',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 24,
                    },
                  ]}
                >
                  <Mic size={40} color="#fff" />
                </Animated.View>
                <Text className={cn(
                  "text-xl font-bold mb-2",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Listening...
                </Text>
                <Text className={cn(
                  "text-sm text-center mb-6",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  Describe your recipe including name, ingredients, and instructions
                </Text>
                <Pressable
                  onPress={stopRecording}
                  className={cn(
                    "w-full py-4 rounded-2xl items-center",
                    isDark ? "bg-sage-600" : "bg-sage-500"
                  )}
                >
                  <Text className="text-white font-semibold text-base">Done Speaking</Text>
                </Pressable>
              </>
            ) : isProcessing ? (
              <>
                <View className={cn(
                  "w-24 h-24 rounded-full items-center justify-center mb-6",
                  isDark ? "bg-charcoal-700" : "bg-cream-100"
                )}>
                  <ActivityIndicator size="large" color={isDark ? '#a6b594' : '#6a7d56'} />
                </View>
                <Text className={cn(
                  "text-xl font-bold mb-2",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Processing...
                </Text>
                <Text className={cn(
                  "text-sm text-center",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  Converting your voice to a recipe
                </Text>
                {transcribedText && (
                  <View className={cn(
                    "mt-4 p-3 rounded-xl w-full",
                    isDark ? "bg-charcoal-700" : "bg-cream-100"
                  )}>
                    <Text className={cn(
                      "text-xs mb-1",
                      isDark ? "text-charcoal-500" : "text-charcoal-400"
                    )}>
                      Transcribed:
                    </Text>
                    <Text className={cn(
                      "text-sm",
                      isDark ? "text-charcoal-300" : "text-charcoal-600"
                    )} numberOfLines={3}>
                      {transcribedText}
                    </Text>
                  </View>
                )}
              </>
            ) : voiceError ? (
              <>
                <View className={cn(
                  "w-24 h-24 rounded-full items-center justify-center mb-6",
                  "bg-red-100"
                )}>
                  <MicOff size={40} color="#dc2626" />
                </View>
                <Text className={cn(
                  "text-xl font-bold mb-2",
                  isDark ? "text-white" : "text-charcoal-900"
                )}>
                  Oops!
                </Text>
                <Text className={cn(
                  "text-sm text-center mb-6",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  {voiceError}
                </Text>
                <View className="flex-row w-full space-x-3">
                  <Pressable
                    onPress={cancelRecording}
                    className={cn(
                      "flex-1 py-4 rounded-2xl items-center",
                      isDark ? "bg-charcoal-700" : "bg-cream-200"
                    )}
                  >
                    <Text className={cn(
                      "font-semibold",
                      isDark ? "text-white" : "text-charcoal-700"
                    )}>
                      Type Instead
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setVoiceError(null);
                      startRecording();
                    }}
                    className={cn(
                      "flex-1 py-4 rounded-2xl items-center",
                      isDark ? "bg-terracotta-600" : "bg-terracotta-500"
                    )}
                  >
                    <Text className="text-white font-semibold">Try Again</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {(isRecording || isProcessing) && (
              <Pressable
                onPress={cancelRecording}
                className="mt-4"
              >
                <Text className={cn(
                  "text-sm",
                  isDark ? "text-charcoal-400" : "text-charcoal-500"
                )}>
                  Cancel
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Upload Recipe Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="fade"
        onRequestClose={cancelUpload}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                cancelUpload();
              }}
              className="flex-1 bg-black/70 justify-end"
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                className={cn(
                  "w-full rounded-t-3xl p-6 max-h-[85%]",
                  isDark ? "bg-charcoal-800" : "bg-white"
                )}
              >
                {isUploadProcessing ? (
                  <View className="items-center py-8">
                    <View className={cn(
                      "w-20 h-20 rounded-full items-center justify-center mb-5",
                      isDark ? "bg-charcoal-700" : "bg-cream-100"
                    )}>
                      <ActivityIndicator size="large" color={isDark ? '#a6b594' : '#6a7d56'} />
                    </View>
                    <Text className={cn(
                      "text-lg font-bold mb-2",
                      isDark ? "text-white" : "text-charcoal-900"
                    )}>
                      Processing Recipe...
                    </Text>
                    <Text className={cn(
                      "text-sm text-center",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Extracting recipe details from your content
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                  >
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-5">
                      <Text className={cn(
                        "text-xl font-bold",
                        isDark ? "text-white" : "text-charcoal-900"
                      )}>
                        Upload Recipe
                      </Text>
                      <Pressable onPress={cancelUpload}>
                        <X size={24} color={isDark ? '#888' : '#666'} />
                      </Pressable>
                    </View>

                    {/* Error message */}
                    {uploadError && (
                      <View className="bg-red-100 rounded-xl p-3 mb-4">
                        <Text className="text-red-600 text-sm text-center">{uploadError}</Text>
                      </View>
                    )}

                    {/* Image upload options */}
                    <Text className={cn(
                      "text-sm font-medium mb-3",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Upload an image
                    </Text>
                    <View className="flex-row gap-3 mb-5">
                      <Pressable
                        onPress={handleCameraCapture}
                        className={cn(
                          "flex-1 flex-row items-center justify-center py-4 rounded-2xl",
                          isDark ? "bg-charcoal-700" : "bg-cream-100"
                        )}
                      >
                        <Camera size={20} color={isDark ? '#a6b594' : '#6a7d56'} />
                        <Text className={cn(
                          "text-sm font-semibold ml-2",
                          isDark ? "text-white" : "text-charcoal-900"
                        )}>
                          Camera
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleImageUpload}
                        className={cn(
                          "flex-1 flex-row items-center justify-center py-4 rounded-2xl",
                          isDark ? "bg-charcoal-700" : "bg-cream-100"
                        )}
                      >
                        <ImageIcon size={20} color={isDark ? '#a6b594' : '#6a7d56'} />
                        <Text className={cn(
                          "text-sm font-semibold ml-2",
                          isDark ? "text-white" : "text-charcoal-900"
                        )}>
                          Photos
                        </Text>
                      </Pressable>
                    </View>

                    {/* Divider */}
                    <View className="flex-row items-center mb-5">
                      <View className={cn("flex-1 h-px", isDark ? "bg-charcoal-700" : "bg-cream-200")} />
                      <Text className={cn("mx-4 text-xs", isDark ? "text-charcoal-500" : "text-charcoal-400")}>
                        or paste text
                      </Text>
                      <View className={cn("flex-1 h-px", isDark ? "bg-charcoal-700" : "bg-cream-200")} />
                    </View>

                    {/* Text input */}
                    <Text className={cn(
                      "text-sm font-medium mb-2",
                      isDark ? "text-charcoal-400" : "text-charcoal-500"
                    )}>
                      Paste recipe text
                    </Text>
                    <TextInput
                      value={uploadText}
                      onChangeText={setUploadText}
                      placeholder="Paste your recipe here... (ingredients, instructions, etc.)"
                      placeholderTextColor={isDark ? '#6d6d6d' : '#888888'}
                      multiline
                      numberOfLines={4}
                      className={cn(
                        "px-4 py-3 rounded-2xl text-sm mb-4",
                        isDark ? "bg-charcoal-700 text-white" : "bg-cream-100 text-charcoal-900"
                      )}
                      style={{ minHeight: 100, textAlignVertical: 'top' }}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      onSubmitEditing={Keyboard.dismiss}
                    />

                    {/* Process text button */}
                    <Pressable
                      onPress={() => {
                        Keyboard.dismiss();
                        handleProcessText();
                      }}
                      disabled={!uploadText.trim()}
                      className={cn(
                        "flex-row items-center justify-center py-4 rounded-2xl mb-4",
                        uploadText.trim()
                          ? isDark ? "bg-sage-600" : "bg-sage-500"
                          : isDark ? "bg-charcoal-700" : "bg-cream-200"
                      )}
                    >
                      <FileText size={20} color={uploadText.trim() ? '#fff' : isDark ? '#6d6d6d' : '#888888'} />
                      <Text className={cn(
                        "text-base font-semibold ml-2",
                        uploadText.trim() ? "text-white" : isDark ? "text-charcoal-500" : "text-charcoal-400"
                      )}>
                        Extract Recipe from Text
                      </Text>
                    </Pressable>
                  </ScrollView>
                )}
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
