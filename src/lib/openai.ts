import type { Ingredient, UserPreferences } from './store';
import { fetch } from 'expo/fetch';

export type PlanDuration = 'single' | 'week1' | 'week2' | 'week3' | 'week4' | 'monthly';

// Get OpenAI API key fresh each time (not cached at module load)
function getOpenAIKey(): string {
  return process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY || '';
}

async function callOpenAIDirect(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = getOpenAIKey();

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add it in the API tab.');
  }

  console.log('[OpenAI] Calling API directly...');
  console.log('[OpenAI] Key prefix:', apiKey.substring(0, 10) + '...');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.8,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[OpenAI] API error:', response.status, errorData);
    throw new Error(errorData?.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  console.log('[OpenAI] Response received successfully');
  return content;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface GenerateRecipeParams {
  mealTypes: MealType[];
  preferences: UserPreferences;
  additionalInstructions?: string;
  duration?: PlanDuration;
  recipesToGenerate?: number;
  optimizeGrocery?: boolean;
  numberOfDays?: number;
}

export interface GeneratedRecipeResponse {
  name: string;
  description: string;
  cookTime: number;
  prepTime: number;
  servings: number;
  mealType?: MealType;
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
    category: Ingredient['category'];
  }>;
  instructions: string[];
  tags: string[];
  calories: number;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export function getDurationDays(duration: PlanDuration): number {
  switch (duration) {
    case 'week1': return 7;
    case 'week2': return 14;
    case 'week3': return 21;
    case 'week4': return 28;
    case 'monthly': return 30;
    default: return 1;
  }
}

// Helper to clean and parse JSON from AI response
function parseJSONResponse(text: string, expectArray: boolean = false): unknown {
  let cleanedText = text.trim();

  // Remove markdown code blocks
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }

  // Find the JSON in the response
  const startChar = expectArray ? '[' : '{';
  const endChar = expectArray ? ']' : '}';
  const jsonStartIndex = cleanedText.indexOf(startChar);
  const jsonEndIndex = cleanedText.lastIndexOf(endChar);

  if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
    cleanedText = cleanedText.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  return JSON.parse(cleanedText.trim());
}

// Build a simple prompt for generating a single recipe
function buildSingleRecipePrompt(
  mealType: MealType,
  preferences: UserPreferences,
  additionalInstructions?: string,
  excludeNames: string[] = [],
  sharedIngredients: string[] = []
): string {
  let prompt = `Generate a ${mealType} recipe`;

  if (preferences.dietaryRestrictions.length > 0) {
    prompt += ` that is ${preferences.dietaryRestrictions.join(', ')}`;
  }

  if (preferences.cuisinePreferences.length > 0) {
    prompt += `. Preferred cuisines: ${preferences.cuisinePreferences.join(', ')}`;
  }

  if (preferences.allergies.length > 0) {
    prompt += `. AVOID these allergens: ${preferences.allergies.join(', ')}`;
  }

  prompt += `. Skill level: ${preferences.cookingSkillLevel}`;
  prompt += `. Prep time preference: ${preferences.mealPrepTime}`;
  prompt += `. Servings: ${preferences.servingSize}`;

  if (sharedIngredients.length > 0) {
    prompt += `. Try to incorporate some of these ingredients: ${sharedIngredients.join(', ')}`;
  }

  if (additionalInstructions) {
    prompt += `. Additional requirements: ${additionalInstructions}`;
  }

  if (excludeNames.length > 0) {
    prompt += `. Do NOT generate these recipes (already created): ${excludeNames.join(', ')}`;
  }

  prompt += `

Return a JSON object with this exact structure:
{
  "name": "Recipe Name",
  "description": "A brief, appetizing description",
  "mealType": "${mealType}",
  "cookTime": 20,
  "prepTime": 10,
  "servings": ${preferences.servingSize},
  "ingredients": [
    {"name": "Ingredient", "quantity": "1", "unit": "cup", "category": "produce|dairy|meat|pantry|frozen|bakery|other"}
  ],
  "instructions": ["Step 1", "Step 2"],
  "tags": ["tag1", "tag2"],
  "calories": 400
}

Only return valid JSON, no markdown or explanation.`;

  return prompt;
}

// Call OpenAI API to generate a single recipe (direct API call)
async function callOpenAIForRecipe(prompt: string): Promise<GeneratedRecipeResponse> {
  const text = await callOpenAIDirect([
    {
      role: 'system',
      content: 'You are a helpful chef assistant that generates recipes in JSON format. Only output valid JSON, no markdown or explanations.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]);

  const recipe = parseJSONResponse(text, false) as GeneratedRecipeResponse;
  return recipe;
}

// Generate a single recipe (public API)
export async function generateRecipe(
  params: GenerateRecipeParams
): Promise<GeneratedRecipeResponse> {
  // Check if OpenAI is configured
  if (!getOpenAIKey()) {
    throw new Error('OpenAI API key not configured. Please add it in the API tab.');
  }

  const mealType = params.mealTypes[0] ?? 'dinner';
  const prompt = buildSingleRecipePrompt(
    mealType,
    params.preferences,
    params.additionalInstructions
  );

  console.log('Generating single recipe...');
  const recipe = await callOpenAIForRecipe(prompt);
  recipe.mealType = mealType;
  console.log('Generated recipe:', recipe.name);
  return recipe;
}

// Generate a meal plan with exact number of recipes using parallel API calls
export async function generateMealPlan(
  params: GenerateRecipeParams
): Promise<GeneratedRecipeResponse[]> {
  // Check if OpenAI is configured
  if (!getOpenAIKey()) {
    throw new Error('OpenAI API key not configured. Please add it in the API tab.');
  }

  const { mealTypes, preferences, additionalInstructions, optimizeGrocery } = params;
  const totalToGenerate = params.recipesToGenerate ?? 1;

  console.log('=== MEAL PLAN GENERATION START ===');
  console.log('Total recipes to generate:', totalToGenerate);
  console.log('Meal types:', mealTypes);

  // Build shared ingredients list for grocery optimization
  const sharedIngredients: string[] = [];
  if (optimizeGrocery) {
    sharedIngredients.push('chicken', 'rice', 'onion', 'garlic', 'olive oil', 'lemon', 'bell pepper', 'tomato');
  }

  // Create all recipe generation promises in parallel
  const recipePromises: Promise<GeneratedRecipeResponse | null>[] = [];

  for (let i = 0; i < totalToGenerate; i++) {
    // Cycle through meal types
    const mealType = mealTypes[i % mealTypes.length];

    const prompt = buildSingleRecipePrompt(
      mealType,
      preferences,
      additionalInstructions,
      [], // Can't exclude names in parallel, but temperature variation ensures uniqueness
      optimizeGrocery ? sharedIngredients : []
    );

    // Create promise for this recipe (with error handling)
    const recipePromise = callOpenAIForRecipe(prompt)
      .then(recipe => {
        recipe.mealType = mealType;
        console.log(`Generated: ${recipe.name} (${mealType})`);
        return recipe;
      })
      .catch(error => {
        console.error(`Failed to generate recipe ${i + 1}:`, error);
        return null; // Return null for failed recipes
      });

    recipePromises.push(recipePromise);
  }

  console.log(`Generating ${totalToGenerate} recipes in parallel...`);

  // Wait for all recipes to complete
  const results = await Promise.all(recipePromises);

  // Filter out any failed recipes (nulls)
  const recipes = results.filter((r): r is GeneratedRecipeResponse => r !== null);

  console.log('=== MEAL PLAN GENERATION COMPLETE ===');
  console.log(`Generated ${recipes.length} of ${totalToGenerate} recipes`);

  return recipes;
}

/**
 * Check if OpenAI is configured (sync version for UI)
 * Now checks if Supabase is configured since OpenAI calls go through Edge Functions
 */
export function isOpenAIConfigured(): boolean {
  // Check if Supabase is configured - OpenAI API key is now on the server
  return !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

// Generate a single replacement recipe for a meal plan
export async function regenerateSingleRecipe(
  params: GenerateRecipeParams,
  excludeRecipeNames: string[] = []
): Promise<GeneratedRecipeResponse> {
  // Check if OpenAI is configured
  if (!getOpenAIKey()) {
    throw new Error('OpenAI API key not configured. Please add it in the API tab.');
  }

  const mealType = params.mealTypes[0] ?? 'dinner';
  const prompt = buildSingleRecipePrompt(
    mealType,
    params.preferences,
    params.additionalInstructions,
    excludeRecipeNames
  );

  console.log('Regenerating single recipe...');
  const recipe = await callOpenAIForRecipe(prompt);
  recipe.mealType = mealType;
  console.log('Regenerated recipe:', recipe.name);
  return recipe;
}

// Pixabay API response types
interface PixabayImage {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  previewURL: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayImage[];
}

// Default fallback image if Pixabay fails
const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800';

export async function generateRecipeImage(recipeName: string, recipeDescription: string): Promise<string> {
  const pixabayApiKey = process.env.EXPO_PUBLIC_PIXABAY_API_KEY;

  if (!pixabayApiKey) {
    console.log('Pixabay API key not configured, using fallback image');
    return DEFAULT_FOOD_IMAGE;
  }

  // Extract key food terms from the recipe name for better search results
  const foodTerms = recipeName
    .toLowerCase()
    .replace(/with|and|the|a|an|in|on|for|of|to/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Create search query - add "food" to improve relevance
  const searchQuery = encodeURIComponent(`${foodTerms} food`);

  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${pixabayApiKey}&q=${searchQuery}&image_type=photo&category=food&per_page=10&safesearch=true`
    );

    if (!response.ok) {
      console.log(`Pixabay API error: ${response.status}, using fallback image`);
      return DEFAULT_FOOD_IMAGE;
    }

    const data: PixabayResponse = await response.json();

    if (data.hits && data.hits.length > 0) {
      // Pick a random image from the results for variety
      const randomIndex = Math.floor(Math.random() * Math.min(data.hits.length, 5));
      const selectedImage = data.hits[randomIndex];
      console.log(`Found Pixabay image for recipe: ${recipeName}`);
      return selectedImage.largeImageURL;
    }

    // If no results with food terms, try a more generic search
    console.log(`No Pixabay results for "${foodTerms}", trying generic food search`);

    const genericResponse = await fetch(
      `https://pixabay.com/api/?key=${pixabayApiKey}&q=delicious+meal&image_type=photo&category=food&per_page=10&safesearch=true`
    );

    if (genericResponse.ok) {
      const genericData: PixabayResponse = await genericResponse.json();
      if (genericData.hits && genericData.hits.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(genericData.hits.length, 5));
        return genericData.hits[randomIndex].largeImageURL;
      }
    }

    console.log(`Using fallback image for recipe: ${recipeName}`);
    return DEFAULT_FOOD_IMAGE;
  } catch (error) {
    console.error('Error fetching Pixabay image:', error);
    return DEFAULT_FOOD_IMAGE;
  }
}
