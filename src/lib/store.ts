import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as db from './database';
import { useAuthStore } from './auth-store';
import { normalizeIngredientName, getCanonicalIngredientName, shouldCombineIngredients } from './ingredient-aliases';

// Types
export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen' | 'bakery' | 'other';
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  cookTime: number; // in minutes
  prepTime: number; // in minutes
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  calories?: number;
  isAIGenerated: boolean;
  isImported?: boolean; // true if imported from URL/text/image
  sourceUrl?: string; // original URL if imported from web
  isSaved: boolean;
  createdAt: string;
}

export interface MealSlot {
  id: string;
  date: string; // ISO date string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeId: string | null;
  customMealName?: string;
  servingOverride?: number; // Custom serving size for this meal slot
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: Ingredient['category'];
  isChecked: boolean;
  recipeIds: string[]; // recipes this item is from
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface UserPreferences {
  dietaryRestrictions: string[];
  cuisinePreferences: string[];
  allergies: string[];
  servingSize: number;
  cookingSkillLevel: 'beginner' | 'intermediate' | 'advanced';
  mealPrepTime: 'quick' | 'moderate' | 'elaborate';
  hasCompletedOnboarding: boolean;
}

interface MealPlanStore {
  // Hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Sync state
  isSyncing: boolean;
  lastSyncError: string | null;

  // User Profile
  userProfile: UserProfile | null;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  clearUserProfile: () => void;

  // User Preferences
  preferences: UserPreferences;
  setPreferences: (preferences: Partial<UserPreferences>) => void;

  // Recipes
  recipes: Recipe[];
  addRecipe: (recipe: Recipe) => string;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  toggleSaveRecipe: (id: string) => void;

  // Meal Plan
  mealSlots: MealSlot[];
  addMealToSlot: (slot: MealSlot) => void;
  removeMealFromSlot: (slotId: string) => void;
  updateMealSlot: (slotId: string, updates: Partial<MealSlot>) => void;
  clearWeekPlan: (startDate: string) => void;

  // Grocery List
  groceryItems: GroceryItem[];
  generateGroceryList: (startDate: string, endDate: string) => void;
  toggleGroceryItem: (itemId: string) => void;
  addGroceryItem: (item: Omit<GroceryItem, 'id'>) => void;
  removeGroceryItem: (itemId: string) => void;
  clearGroceryList: () => void;
  clearCheckedItems: () => void;

  // View State
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  viewMode: 'weekly' | 'monthly';
  setViewMode: (mode: 'weekly' | 'monthly') => void;

  // Sync methods
  loadUserData: (userId: string) => Promise<void>;
  clearAllData: () => void;
}

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

// Helper to check if a string is a valid UUID
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Get current user ID helper
const getCurrentUserId = (): string | null => {
  return useAuthStore.getState().currentUser?.id || null;
};

const defaultPreferences: UserPreferences = {
  dietaryRestrictions: [],
  cuisinePreferences: [],
  allergies: [],
  servingSize: 2,
  cookingSkillLevel: 'intermediate',
  mealPrepTime: 'moderate',
  hasCompletedOnboarding: false,
};

// Helper function to format date as YYYY-MM-DD in local timezone
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const useMealPlanStore = create<MealPlanStore>()(
  persist(
    (set, get) => ({
      // Hydration state
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Sync state
      isSyncing: false,
      lastSyncError: null,

      // User Profile
      userProfile: null,
      setUserProfile: (profile) =>
        set((state) => {
          if (state.userProfile) {
            return { userProfile: { ...state.userProfile, ...profile } };
          }
          return {
            userProfile: {
              id: generateId(),
              name: profile.name || 'User',
              email: profile.email,
              avatarUrl: profile.avatarUrl,
              createdAt: new Date().toISOString(),
            },
          };
        }),
      clearUserProfile: () => set({ userProfile: null }),

      // Initial state
      preferences: defaultPreferences,
      recipes: [],
      mealSlots: [],
      groceryItems: [],
      selectedDate: formatLocalDate(new Date()),
      viewMode: 'weekly',

      // Preferences - with sync
      setPreferences: (newPreferences) => {
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          const { preferences } = get();
          db.upsertUserPreferences(userId, preferences);
        }
      },

      // Recipes - with sync
      addRecipe: (recipe) => {
        const tempId = recipe.id || generateId();
        const newRecipe = { ...recipe, id: tempId };

        set((state) => ({
          recipes: [...state.recipes, newRecipe],
        }));

        // Sync to database and update with real ID
        const userId = getCurrentUserId();
        if (userId) {
          db.insertRecipe(userId, newRecipe).then((dbId) => {
            if (dbId && dbId !== tempId) {
              console.log(`Recipe ID updated: ${tempId} -> ${dbId}`);
              // Update the local recipe with the database-generated ID
              const currentState = get();
              const affectedSlots = currentState.mealSlots.filter(
                (s) => s.recipeId === tempId
              );

              console.log(`Found ${affectedSlots.length} meal slots to update`);

              set((state) => ({
                recipes: state.recipes.map((r) =>
                  r.id === tempId ? { ...r, id: dbId } : r
                ),
                // Also update any meal slots that reference this recipe
                mealSlots: state.mealSlots.map((s) =>
                  s.recipeId === tempId ? { ...s, recipeId: dbId } : s
                ),
              }));

              // Update affected meal slots in the database with the new recipe ID
              affectedSlots.forEach((slot) => {
                console.log(`Syncing meal slot for date ${slot.date}, type ${slot.mealType} with recipe ${dbId}`);
                db.upsertMealSlot(userId, { ...slot, recipeId: dbId });
              });
            }
          });
        }

        return tempId;
      },

      updateRecipe: (id, updates) => {
        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.updateRecipe(userId, id, updates);
        }
      },

      deleteRecipe: (id) => {
        set((state) => ({
          recipes: state.recipes.filter((r) => r.id !== id),
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.deleteRecipe(userId, id);
        }
      },

      toggleSaveRecipe: (id) => {
        const recipe = get().recipes.find((r) => r.id === id);
        const newIsSaved = recipe ? !recipe.isSaved : true;

        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, isSaved: newIsSaved } : r
          ),
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.updateRecipe(userId, id, { isSaved: newIsSaved });
        }
      },

      // Meal Plan - with sync
      addMealToSlot: (slot) => {
        const slotWithId = { ...slot, id: slot.id || generateId() };

        set((state) => {
          // Check if this exact recipe is already added for this date and meal type
          const isDuplicate = state.mealSlots.some(
            (s) => s.date === slot.date && s.mealType === slot.mealType && s.recipeId === slot.recipeId
          );

          // If it's a duplicate, don't add it again
          if (isDuplicate) {
            return state;
          }

          // Always add as a new slot to support multiple recipes per meal type
          return { mealSlots: [...state.mealSlots, slotWithId] };
        });

        // Only sync to database if recipeId is a valid UUID
        // If recipeId is a temp ID, the addRecipe callback will sync when it gets the real UUID
        const userId = getCurrentUserId();
        if (userId && slotWithId.recipeId && isValidUUID(slotWithId.recipeId)) {
          db.upsertMealSlot(userId, slotWithId);
        }
      },

      removeMealFromSlot: (slotId) => {
        set((state) => ({
          mealSlots: state.mealSlots.filter((s) => s.id !== slotId),
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.deleteMealSlot(userId, slotId);
        }
      },

      updateMealSlot: (slotId, updates) => {
        let updatedSlot: MealSlot | null = null;

        set((state) => {
          const newSlots = state.mealSlots.map((s) => {
            if (s.id === slotId) {
              const newSlot = { ...s, ...updates };
              updatedSlot = newSlot;
              return newSlot;
            }
            return s;
          });
          return { mealSlots: newSlots };
        });

        // Only sync to database if recipeId is a valid UUID
        const userId = getCurrentUserId();
        const slotToSync = updatedSlot as MealSlot | null;
        if (userId && slotToSync && slotToSync.recipeId && isValidUUID(slotToSync.recipeId)) {
          db.upsertMealSlot(userId, slotToSync);
        }
      },

      clearWeekPlan: (startDate) => {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        const endDateStr = formatLocalDate(end);

        set((state) => ({
          mealSlots: state.mealSlots.filter((s) => {
            const slotDate = new Date(s.date);
            return slotDate < start || slotDate >= end;
          }),
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.clearMealSlotsInRange(userId, startDate, endDateStr);
        }
      },

      // Grocery List - with sync
      generateGroceryList: (startDate, endDate) => {
        const { mealSlots, recipes } = get();

        const slotsInRange = mealSlots.filter((s) => {
          return s.date >= startDate && s.date <= endDate && s.recipeId;
        });

        const ingredientMap = new Map<string, GroceryItem>();

        slotsInRange.forEach((slot) => {
          const recipe = recipes.find((r) => r.id === slot.recipeId);
          if (!recipe) return;

          // Calculate serving multiplier based on serving override
          const servingMultiplier = slot.servingOverride ? slot.servingOverride / recipe.servings : 1;

          recipe.ingredients.forEach((ing) => {
            // Create a key using normalized name, unit, and category for intelligent combining
            const normalizedName = normalizeIngredientName(ing.name);
            const key = `${normalizedName}-${ing.unit}-${ing.category}`;
            const existing = ingredientMap.get(key);

            // Calculate adjusted quantity based on serving override
            const baseQty = parseFloat(ing.quantity) || 0;
            const adjustedQty = baseQty * servingMultiplier;

            if (existing) {
              // Combine quantities
              const existingQty = parseFloat(existing.quantity) || 0;
              existing.quantity = (existingQty + adjustedQty).toString();
              // Avoid duplicate recipe IDs
              if (!existing.recipeIds.includes(slot.recipeId!)) {
                existing.recipeIds = [...existing.recipeIds, slot.recipeId!];
              }
            } else {
              // Use canonical name for display
              const canonicalName = getCanonicalIngredientName(ing.name);
              ingredientMap.set(key, {
                id: generateId(),
                name: canonicalName,
                quantity: adjustedQty.toString(),
                unit: ing.unit,
                category: ing.category,
                isChecked: false,
                recipeIds: [slot.recipeId!],
              });
            }
          });
        });

        const groceryItems = Array.from(ingredientMap.values());
        set({ groceryItems });

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.replaceUserGroceryItems(userId, groceryItems);
        }
      },

      toggleGroceryItem: (itemId) => {
        let newIsChecked = false;

        set((state) => ({
          groceryItems: state.groceryItems.map((item) => {
            if (item.id === itemId) {
              newIsChecked = !item.isChecked;
              return { ...item, isChecked: newIsChecked };
            }
            return item;
          }),
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.updateGroceryItem(userId, itemId, { isChecked: newIsChecked });
        }
      },

      addGroceryItem: (item) => {
        const newItem = { ...item, id: generateId() };

        set((state) => ({
          groceryItems: [...state.groceryItems, newItem],
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.insertGroceryItem(userId, newItem);
        }
      },

      removeGroceryItem: (itemId) => {
        set((state) => ({
          groceryItems: state.groceryItems.filter((item) => item.id !== itemId),
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.deleteGroceryItem(userId, itemId);
        }
      },

      clearGroceryList: () => {
        set({ groceryItems: [] });

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.clearUserGroceryItems(userId);
        }
      },

      clearCheckedItems: () => {
        set((state) => ({
          groceryItems: state.groceryItems.filter((item) => !item.isChecked),
        }));

        // Sync to database
        const userId = getCurrentUserId();
        if (userId) {
          db.clearCheckedGroceryItems(userId);
        }
      },

      // View State
      setSelectedDate: (date) => set({ selectedDate: date }),
      setViewMode: (mode) => set({ viewMode: mode }),

      // Load user data from database
      loadUserData: async (userId: string) => {
        set({ isSyncing: true, lastSyncError: null });

        try {
          const data = await db.fetchAllUserData(userId);

          set({
            preferences: data.preferences || defaultPreferences,
            recipes: data.recipes,
            mealSlots: data.mealSlots,
            groceryItems: data.groceryItems,
            isSyncing: false,
          });

          console.log('User data loaded:', {
            recipes: data.recipes.length,
            mealSlots: data.mealSlots.length,
            groceryItems: data.groceryItems.length,
          });
        } catch (error) {
          console.error('Error loading user data:', error);
          set({
            isSyncing: false,
            lastSyncError: 'Failed to load data from server'
          });
        }
      },

      // Clear all data (for logout)
      clearAllData: () => {
        set({
          userProfile: null,
          preferences: defaultPreferences,
          recipes: [],
          mealSlots: [],
          groceryItems: [],
          selectedDate: formatLocalDate(new Date()),
          viewMode: 'weekly',
        });
      },
    }),
    {
      name: 'meal-plan-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        userProfile: state.userProfile,
        preferences: state.preferences,
        recipes: state.recipes,
        mealSlots: state.mealSlots,
        groceryItems: state.groceryItems,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
