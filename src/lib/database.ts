import { supabase, isSupabaseConfigured } from './supabase';
import type { Recipe, MealSlot, GroceryItem, UserPreferences, Ingredient } from './store';

// ============ USER SUBSCRIPTION ============

export type AccountStatus = 'active' | 'paused' | 'deleted';

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  is_premium: boolean;
  premium_expires_at: string | null;
  revenuecat_customer_id: string | null;
  account_status: AccountStatus;
  paused_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  email: string;
  name: string | null;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  revenuecatCustomerId: string | null;
  accountStatus: AccountStatus;
  pausedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const mapDbUser = (db: DbUser): UserSubscription => ({
  id: db.id,
  email: db.email,
  name: db.name,
  isPremium: db.is_premium,
  premiumExpiresAt: db.premium_expires_at,
  revenuecatCustomerId: db.revenuecat_customer_id,
  accountStatus: db.account_status || 'active',
  pausedAt: db.paused_at,
  deletedAt: db.deleted_at,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

export async function fetchUserSubscription(userId: string): Promise<UserSubscription | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching user subscription:', error);
    return null;
  }

  return mapDbUser(data as DbUser);
}

export async function upsertUser(
  userId: string,
  email: string,
  name?: string | null
): Promise<UserSubscription | null> {
  const timestamp = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    console.log(`[DB] ${timestamp} - Supabase not configured, skipping user upsert`);
    return null;
  }

  console.log(`[DB] ${timestamp} - START: Upserting user: ${JSON.stringify({ userId, email, name })}`);

  // First try to fetch existing user
  console.log(`[DB] ${timestamp} - Checking if user exists...`);
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = "not found" which is expected for new users
    console.error(`[DB] ${timestamp} - Error fetching user: ${fetchError.message}, code: ${fetchError.code}`);
  }

  if (existingUser) {
    console.log(`[DB] ${timestamp} - User exists, updating...`);
    // User exists, just update
    const { data, error } = await supabase
      .from('users')
      .update({
        email,
        name: name ?? existingUser.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error(`[DB] ${timestamp} - ERROR updating user: ${error.message}, code: ${error.code}, details: ${JSON.stringify(error.details)}`);
      return mapDbUser(existingUser as DbUser); // Return existing user even if update fails
    }
    console.log(`[DB] ${timestamp} - SUCCESS: User updated`);
    return mapDbUser(data as DbUser);
  }

  // User doesn't exist, create new one
  console.log(`[DB] ${timestamp} - User not found, creating new user...`);

  const insertData = {
    id: userId,
    email,
    name: name ?? null,
    is_premium: false,
    account_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log(`[DB] ${timestamp} - INSERT DATA: ${JSON.stringify(insertData)}`);

  const { data, error } = await supabase
    .from('users')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error(`[DB] ${timestamp} - ERROR creating user:`);
    console.error(`[DB] ${timestamp} -   Message: ${error.message}`);
    console.error(`[DB] ${timestamp} -   Code: ${error.code}`);
    console.error(`[DB] ${timestamp} -   Details: ${JSON.stringify(error.details)}`);
    console.error(`[DB] ${timestamp} -   Hint: ${error.hint || 'none'}`);

    // If the error is due to RLS or missing table, log more details
    if (error.code === '42501') {
      console.error(`[DB] ${timestamp} - RLS VIOLATION: Permission denied - check RLS policies for users table`);
      console.error(`[DB] ${timestamp} - This usually means auth.uid() is NULL or doesn't match the user ID being inserted`);
    } else if (error.code === '42P01') {
      console.error(`[DB] ${timestamp} - TABLE MISSING: Table does not exist - ensure users table is created`);
    } else if (error.code === '23505') {
      // Duplicate key - user was created between our check and insert
      console.log(`[DB] ${timestamp} - RACE CONDITION: User already exists (created by concurrent call), fetching...`);
      const { data: raceUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (raceUser) {
        console.log(`[DB] ${timestamp} - SUCCESS: Retrieved user from race condition`);
        return mapDbUser(raceUser as DbUser);
      }
    }
    return null;
  }

  console.log(`[DB] ${timestamp} - SUCCESS: User created with ID: ${data?.id}`);
  return mapDbUser(data as DbUser);
}

export async function updateUserPremiumStatus(
  userId: string,
  isPremium: boolean,
  expiresAt?: string | null,
  revenuecatCustomerId?: string | null
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const updates: Record<string, unknown> = {
    is_premium: isPremium,
    updated_at: new Date().toISOString(),
  };

  if (expiresAt !== undefined) {
    updates.premium_expires_at = expiresAt;
  }

  if (revenuecatCustomerId !== undefined) {
    updates.revenuecat_customer_id = revenuecatCustomerId;
  }

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Error updating premium status:', error);
    return false;
  }

  return true;
}

// ============ ACCOUNT MANAGEMENT ============

export async function pauseUserAccount(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('users')
    .update({
      account_status: 'paused',
      paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error pausing account:', error);
    return false;
  }

  return true;
}

export async function resumeUserAccount(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('users')
    .update({
      account_status: 'active',
      paused_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error resuming account:', error);
    return false;
  }

  return true;
}

export async function deleteUserAccount(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  // First, delete all user data from related tables
  const deletePromises = [
    supabase.from('user_preferences').delete().eq('user_id', userId),
    supabase.from('recipes').delete().eq('user_id', userId),
    supabase.from('meal_slots').delete().eq('user_id', userId),
    supabase.from('grocery_items').delete().eq('user_id', userId),
  ];

  const results = await Promise.all(deletePromises);
  const hasDeleteError = results.some((r) => r.error);

  if (hasDeleteError) {
    console.error('Error deleting user data:', results.map((r) => r.error).filter(Boolean));
  }

  // Mark user as deleted (soft delete to preserve audit trail)
  const { error } = await supabase
    .from('users')
    .update({
      account_status: 'deleted',
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error marking account as deleted:', error);
    return false;
  }

  return true;
}

// Type definitions for database rows
interface DbUserPreferences {
  id: string;
  user_id: string;
  dietary_restrictions: string[];
  cuisine_preferences: string[];
  allergies: string[];
  serving_size: number;
  cooking_skill_level: 'beginner' | 'intermediate' | 'advanced';
  meal_prep_time: 'quick' | 'moderate' | 'elaborate';
  has_completed_onboarding: boolean;
}

interface DbRecipe {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  cook_time: number;
  prep_time: number;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  calories: number | null;
  is_ai_generated: boolean;
  is_saved: boolean;
  created_at: string;
}

interface DbMealSlot {
  id: string;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe_id: string | null;
  custom_meal_name: string | null;
  serving_override: number | null;
}

interface DbGroceryItem {
  id: string;
  user_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: Ingredient['category'];
  is_checked: boolean;
  recipe_ids: string[];
}

// Mappers: Database -> App
const mapDbPreferences = (db: DbUserPreferences): UserPreferences => ({
  dietaryRestrictions: db.dietary_restrictions || [],
  cuisinePreferences: db.cuisine_preferences || [],
  allergies: db.allergies || [],
  servingSize: db.serving_size,
  cookingSkillLevel: db.cooking_skill_level,
  mealPrepTime: db.meal_prep_time,
  hasCompletedOnboarding: db.has_completed_onboarding,
});

const mapDbRecipe = (db: DbRecipe): Recipe => ({
  id: db.id,
  name: db.name,
  description: db.description || '',
  imageUrl: db.image_url || '',
  cookTime: db.cook_time,
  prepTime: db.prep_time,
  servings: db.servings,
  ingredients: db.ingredients || [],
  instructions: db.instructions || [],
  tags: db.tags || [],
  calories: db.calories ?? undefined,
  isAIGenerated: db.is_ai_generated,
  isSaved: db.is_saved,
  createdAt: db.created_at,
});

const mapDbMealSlot = (db: DbMealSlot): MealSlot => ({
  id: db.id,
  date: db.date,
  mealType: db.meal_type,
  recipeId: db.recipe_id,
  customMealName: db.custom_meal_name ?? undefined,
  servingOverride: db.serving_override ?? undefined,
});

const mapDbGroceryItem = (db: DbGroceryItem): GroceryItem => ({
  id: db.id,
  name: db.name,
  quantity: db.quantity || '',
  unit: db.unit || '',
  category: db.category,
  isChecked: db.is_checked,
  recipeIds: db.recipe_ids || [],
});

// ============ USER PREFERENCES ============

export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching preferences:', error);
    return null;
  }

  return mapDbPreferences(data as DbUserPreferences);
}

export async function upsertUserPreferences(
  userId: string,
  preferences: UserPreferences
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      dietary_restrictions: preferences.dietaryRestrictions,
      cuisine_preferences: preferences.cuisinePreferences,
      allergies: preferences.allergies,
      serving_size: preferences.servingSize,
      cooking_skill_level: preferences.cookingSkillLevel,
      meal_prep_time: preferences.mealPrepTime,
      has_completed_onboarding: preferences.hasCompletedOnboarding,
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Error saving preferences:', error);
    return false;
  }

  return true;
}

// ============ RECIPES ============

export async function fetchUserRecipes(userId: string): Promise<Recipe[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recipes:', error);
    return [];
  }

  return (data as DbRecipe[]).map(mapDbRecipe);
}

export async function insertRecipe(userId: string, recipe: Recipe): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  // Let Supabase generate the UUID if not provided or invalid
  const insertData: Record<string, unknown> = {
    user_id: userId,
    name: recipe.name,
    description: recipe.description,
    image_url: recipe.imageUrl,
    cook_time: recipe.cookTime,
    prep_time: recipe.prepTime,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    tags: recipe.tags,
    calories: recipe.calories ?? null,
    is_ai_generated: recipe.isAIGenerated,
    is_saved: recipe.isSaved,
    created_at: recipe.createdAt,
  };

  const { data, error } = await supabase
    .from('recipes')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting recipe:', error);
    return null;
  }

  return data?.id || null;
}

export async function updateRecipe(
  userId: string,
  recipeId: string,
  updates: Partial<Recipe>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
  if (updates.cookTime !== undefined) dbUpdates.cook_time = updates.cookTime;
  if (updates.prepTime !== undefined) dbUpdates.prep_time = updates.prepTime;
  if (updates.servings !== undefined) dbUpdates.servings = updates.servings;
  if (updates.ingredients !== undefined) dbUpdates.ingredients = updates.ingredients;
  if (updates.instructions !== undefined) dbUpdates.instructions = updates.instructions;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.calories !== undefined) dbUpdates.calories = updates.calories;
  if (updates.isAIGenerated !== undefined) dbUpdates.is_ai_generated = updates.isAIGenerated;
  if (updates.isSaved !== undefined) dbUpdates.is_saved = updates.isSaved;

  const { error } = await supabase
    .from('recipes')
    .update(dbUpdates)
    .eq('id', recipeId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating recipe:', error);
    return false;
  }

  return true;
}

export async function deleteRecipe(userId: string, recipeId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting recipe:', error);
    return false;
  }

  return true;
}

// ============ MEAL SLOTS ============

export async function fetchUserMealSlots(userId: string): Promise<MealSlot[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('meal_slots')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching meal slots:', error);
    return [];
  }

  return (data as DbMealSlot[]).map(mapDbMealSlot);
}

// Helper to check if a string is a valid UUID
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export async function upsertMealSlot(userId: string, slot: MealSlot): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  // Validate recipe_id is a valid UUID before sending to database
  if (slot.recipeId && !isValidUUID(slot.recipeId)) {
    console.log('Skipping upsert - recipe_id is not a valid UUID yet:', slot.recipeId);
    return false;
  }

  // Don't include id - let Supabase handle it via upsert on conflict
  const { error } = await supabase
    .from('meal_slots')
    .upsert({
      user_id: userId,
      date: slot.date,
      meal_type: slot.mealType,
      recipe_id: slot.recipeId || null,
      custom_meal_name: slot.customMealName ?? null,
      serving_override: slot.servingOverride ?? null,
    }, {
      onConflict: 'user_id,date,meal_type',
    });

  if (error) {
    console.error('Error upserting meal slot:', error);
    return false;
  }

  return true;
}

export async function deleteMealSlot(userId: string, slotId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('meal_slots')
    .delete()
    .eq('id', slotId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting meal slot:', error);
    return false;
  }

  return true;
}

export async function clearMealSlotsInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('meal_slots')
    .delete()
    .eq('user_id', userId)
    .gte('date', startDate)
    .lt('date', endDate);

  if (error) {
    console.error('Error clearing meal slots:', error);
    return false;
  }

  return true;
}

// ============ GROCERY ITEMS ============

export async function fetchUserGroceryItems(userId: string): Promise<GroceryItem[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('grocery_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching grocery items:', error);
    return [];
  }

  return (data as DbGroceryItem[]).map(mapDbGroceryItem);
}

export async function insertGroceryItem(
  userId: string,
  item: GroceryItem
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  // Don't include id - let Supabase generate UUID
  const { data, error } = await supabase
    .from('grocery_items')
    .insert({
      user_id: userId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      is_checked: item.isChecked,
      recipe_ids: item.recipeIds,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting grocery item:', error);
    return null;
  }

  return data?.id || null;
}

export async function updateGroceryItem(
  userId: string,
  itemId: string,
  updates: Partial<GroceryItem>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
  if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.isChecked !== undefined) dbUpdates.is_checked = updates.isChecked;
  if (updates.recipeIds !== undefined) dbUpdates.recipe_ids = updates.recipeIds;

  const { error } = await supabase
    .from('grocery_items')
    .update(dbUpdates)
    .eq('id', itemId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating grocery item:', error);
    return false;
  }

  return true;
}

export async function deleteGroceryItem(userId: string, itemId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('grocery_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting grocery item:', error);
    return false;
  }

  return true;
}

export async function clearUserGroceryItems(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('grocery_items')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error clearing grocery items:', error);
    return false;
  }

  return true;
}

export async function clearCheckedGroceryItems(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('grocery_items')
    .delete()
    .eq('user_id', userId)
    .eq('is_checked', true);

  if (error) {
    console.error('Error clearing checked grocery items:', error);
    return false;
  }

  return true;
}

// ============ BULK OPERATIONS ============

export async function replaceUserGroceryItems(
  userId: string,
  items: GroceryItem[]
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  // Delete all existing items
  const { error: deleteError } = await supabase
    .from('grocery_items')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    console.error('Error clearing grocery items:', deleteError);
    return false;
  }

  if (items.length === 0) return true;

  // Insert all new items (without id - let Supabase generate UUIDs)
  const { error: insertError } = await supabase
    .from('grocery_items')
    .insert(
      items.map((item) => ({
        user_id: userId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        is_checked: item.isChecked,
        recipe_ids: item.recipeIds,
      }))
    );

  if (insertError) {
    console.error('Error inserting grocery items:', insertError);
    return false;
  }

  return true;
}

// ============ FETCH ALL USER DATA ============

export interface UserData {
  preferences: UserPreferences | null;
  recipes: Recipe[];
  mealSlots: MealSlot[];
  groceryItems: GroceryItem[];
}

export async function fetchAllUserData(userId: string): Promise<UserData> {
  const [preferences, recipes, mealSlots, groceryItems] = await Promise.all([
    fetchUserPreferences(userId),
    fetchUserRecipes(userId),
    fetchUserMealSlots(userId),
    fetchUserGroceryItems(userId),
  ]);

  return {
    preferences,
    recipes,
    mealSlots,
    groceryItems,
  };
}
