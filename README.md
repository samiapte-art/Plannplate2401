# Meal Planning App

A beautiful meal planning application built with React Native and Expo that helps you plan your weekly meals, manage recipes, and create grocery lists automatically.

## Features

### 1. User Authentication (Supabase)
- **Sign Up**: Create a new account with email, password, and full name
- **Login**: Secure login with email and password for existing accounts
- **Duplicate Email Prevention**: Attempting to sign up with an existing email shows clear error and redirects to login
- **Protected Routes**: App content only accessible after authentication
- **Session Persistence**: Users stay logged in across app restarts
- **Real-time Auth Sync**: App responds instantly to auth state changes
- **User Profile**: View your account details in Settings
- **Sign Out**: Easily log out from the Settings tab
- **Password Reset**: Secure OTP-based password reset within the app
- **Pause Account**: Temporarily disable access while keeping your data safe
- **Delete Account**: Permanently remove your account and all data

#### Password Reset Flow
The app uses a secure OTP (One-Time Password) based password reset instead of browser-based links:
1. User taps "Forgot Password?" on login screen
2. Enters their email address
3. Receives a 6-digit OTP via email (valid for 30 minutes)
4. Enters the OTP in the app verification screen
5. Once verified, password reset screen opens within the app
6. User sets a new password and confirms it
7. Password is immediately updated and user can log in with new password

#### Authentication Architecture
- **Separate Flows**: Sign Up uses `auth.signUp()`, Login uses `signInWithPassword()` - never mixed
- **Session Detection**: On app startup, checks for valid session and routes accordingly
- **Error Handling**: Clear, user-friendly error messages for all auth scenarios
- **Session Storage**: Secure AsyncStorage on mobile, auto-refresh tokens enabled
- **OTP Verification**: Uses Supabase's OTP verification system with 30-minute expiry

### 2. Meal Planning
- **Daily Navigation**: Use the left/right chevron buttons to move across dates day-by-day, or tap on any day in the horizontal calendar
- **Dynamic Week Display**: The week number automatically updates as you navigate to different dates
- **Meal Slots**: Plan breakfast, lunch, dinner, and snacks for each day
- **Multiple Recipes Per Meal**: Add multiple recipes to each meal type (e.g., multiple dishes for dinner) with a count badge showing how many recipes are planned
- **Clean Meal Card Display**: Meal cards show only the recipe image, name, time, and calories. A count badge appears when multiple recipes are assigned
- **Recipes Management Modal**: Tap on any meal card with recipes to open a modal where you can:
  - **Edit Serving Sizes**: Adjust portions with a Settings button. Increase or decrease servings with +/- buttons or preset shortcuts (1, 2, 4, 6 servings). View all ingredients with automatically calculated quantities based on the new serving size
  - **Swap Recipes**: Replace any recipe with a different one using the refresh button
  - **Delete Recipes**: Remove recipes from your meal using the trash button
  - **Add More**: Add additional recipes to the same meal type using the plus button in the modal header
  - **Close Modal**: Tap outside the modal area to close it
- **Visual Progress**: Track how many meals you've planned for the week
- **Quick Add**: Tap the "Add meal-type" button on empty meal slots to quickly add recipes
- **Curated Meal Plans**: Choose from predefined meal plans to automatically fill your calendar:
  - **Balanced Everyday Plan** (Default): 7-day moderate portions with familiar Australian foods, perfect for families
  - **High-Protein Simple Plan**: 7-day muscle-supporting meals with protein in every meal, ideal for fitness and everyday energy
  - **Family-Friendly Plan**: 7-day plan with one base meal and easy swaps for mixed ages. Kid-friendly textures with optional spice/sauce add-ons for adults
  - **Budget-Smart Plan**: 7-day low-cost meal plan using pantry staples and repeated ingredients. Perfect for students and budget-conscious households
  - **Light & Digestive Easy Plan**: 7-day gentle, low-spice meals for seniors and people with sensitive digestion. Features porridge, soups, steamed vegetables with protein, and yogurt-based meals
  - **Healthy Week**: 7-day balanced meal plan focused on whole foods, lean proteins, and vegetables
  - **Quick & Easy**: 5-day plan with recipes that take 30 minutes or less
  - **Vegetarian Delight**: 7-day plant-based meal plan packed with protein and nutrients
  - Each plan includes breakfast, lunch, and dinner with detailed recipes tailored to Australian eating preferences
  - **Flexible Start Date**: When applying a plan, choose which date to start the meal plan. Use the chevron buttons to navigate to your preferred start date
  - Plans automatically add recipes to your collection and assign them to your meal calendar starting from your selected date

### 3. Recipe Management
- **Recipe Collection**: Browse and manage your recipes
- **Save Favorites**: Mark recipes as favorites with the heart icon for quick access
- **Search & Filter**: Search recipes by name or filter by category (Breakfast, Quick, Healthy, etc.)
- **Saved Tab**: View only your favorited recipes by toggling the "Saved" filter button
- **Recipe Details**: View full ingredients list, instructions, cook time, and calories
- **AI Recipe Generation**: Generate new recipes based on your preferences (uses OpenAI API directly)
- **Meal Plan Generation**: Generate multiple recipes at once for 1-4 weeks or a full month
- **Calendar Integration**: Select a start date and recipes are automatically assigned to your meal plan
- **Add from Existing Recipes**: Include recipes from your collection in your AI-generated meal plan
- **Import Recipes**: Import recipes from URLs (Instagram, TikTok, Pinterest, YouTube, recipe websites) or pasted text
- **Voice Input**: Speak your recipe and it automatically fills in all recipe details (uses OpenAI Whisper)
- **Upload Recipes**: Upload recipe images or paste recipe text, and AI automatically extracts and fills in the recipe fields (uses GPT-4o vision)
- **Recipe Source Badges**: Each recipe shows its source with a color-coded badge:
  - **AI** (orange): AI-generated recipes
  - **Imported** (blue): Imported from URL, text, image, or voice
  - **Custom** (green): Manually added recipes
- **Source URL Links**: Imported recipes from web URLs display a link icon - tap to open the original recipe source in your browser
- **Default Unsaved**: All new recipes (AI-generated, imported, or manually added) start as unsaved. Tap the heart icon to mark as favorite and add to your "Saved" collection.

### 4. Grocery List
- **Auto-Generate**: Create grocery lists automatically from your meal plan
- **Organized by Category**: Items grouped by produce, dairy, meat, pantry, etc.
- **Check Off Items**: Mark items as purchased while shopping
- **Manual Add**: Add custom items to your list
- **Clear Completed**: Remove checked items with one tap

### 5. User Preferences
- **Dietary Restrictions**: Set vegetarian, vegan, gluten-free, keto, and more
- **Cuisine Preferences**: Choose your favorite cuisines (Italian, Asian, Mediterranean, etc.)
- **Food Allergies**: Mark allergens to avoid in AI-generated recipes
- **Serving Size**: Set default portions for recipes
- **Cooking Skill Level**: Match recipes to your experience
- **Prep Time Preference**: Choose quick, moderate, or elaborate recipes

## Project Structure

```
src/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab navigation layout
│   │   ├── index.tsx        # Meal Plan tab (home)
│   │   ├── recipes.tsx      # Recipes tab
│   │   ├── grocery.tsx      # Grocery List tab
│   │   └── preferences.tsx  # Settings tab
│   ├── _layout.tsx          # Root navigation layout with auth protection
│   ├── login.tsx            # Login screen
│   ├── signup.tsx           # Sign up screen
│   ├── verify-otp.tsx       # OTP verification screen for password reset
│   ├── reset-password.tsx   # Password reset screen (OTP-based)
│   ├── select-recipe.tsx    # Recipe selection modal
│   ├── generate-recipe.tsx  # AI recipe generation screen
│   ├── import-recipe.tsx    # Recipe import screen (URL/text)
│   ├── import-review.tsx    # Review imported recipe before saving
│   └── curated-meal-plan.tsx # Curated meal plan selection screen
├── components/
│   ├── StoreHydration.tsx   # Store hydration wrapper
│   └── Themed.tsx           # Themed components
└── lib/
    ├── store.ts             # Zustand store for app state
    ├── auth-store.ts        # Zustand store for authentication (Supabase)
    ├── supabase.ts          # Supabase client configuration
    ├── secure-api.ts        # Secure API client with auth & rate limiting
    ├── openai.ts            # OpenAI API integration
    ├── recipeImport.ts      # Recipe import service with AI extraction
    ├── curated-meal-plans.ts # Predefined meal plan data and helpers
    ├── cn.ts                # className utility
    └── useColorScheme.ts    # Color scheme hook
```

## Tech Stack

- **Framework**: Expo SDK 53, React Native 0.76.7
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand with AsyncStorage persistence
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Animations**: React Native Reanimated
- **Icons**: Lucide React Native
- **Server State**: TanStack React Query

## Supabase Setup

To enable user authentication and data persistence with Supabase:

### 1. Create Supabase Project
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to the ENV tab in the Vibecode app
3. Add your Supabase credentials:
   - `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

You can find these values in your Supabase dashboard under **Settings > API**.

### 2. Set Up Database Tables
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase-schema.sql` from this project
4. Paste and run the SQL to create all required tables

The schema creates the following tables:
- `user_preferences` - Dietary restrictions, cooking preferences
- `recipes` - User's recipe collection
- `meal_slots` - Meal plan assignments
- `grocery_items` - Shopping list items

All tables have Row Level Security (RLS) enabled so users can only access their own data.

### 3. Set Up Auto User Creation Trigger
**IMPORTANT**: Run the `supabase-auto-user-creation.sql` script to automatically create user entries when new users sign up.

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase-auto-user-creation.sql`
4. Paste and run the SQL

This creates:
- **Database Trigger**: Automatically creates a user entry in the `users` table when someone signs up via Supabase Auth
- **Logging Table**: `user_creation_logs` table for debugging user creation issues
- **Helper Functions**: `sync_auth_user_to_users_table()` for manual user sync if needed
- **Backfill Script**: Automatically creates entries for existing auth users who don't have `users` table entries

#### Debugging User Creation Issues
To view user creation logs:
```sql
SELECT * FROM user_creation_logs ORDER BY created_at DESC LIMIT 20;
```

To check for auth users without users table entries:
```sql
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE u.id IS NULL;
```

To manually sync a specific user:
```sql
SELECT sync_auth_user_to_users_table('user-uuid-here');
```

### Authentication Features
- Email/password sign up and login
- Automatic session persistence
- Secure token refresh
- Protected routes (requires login to access app)

### Data Persistence Features
- All recipes sync to cloud automatically
- Meal plans persist across devices
- User preferences saved to database
- Grocery lists synced in real-time

## AI Recipe Generation

### Security & Authentication

All OpenAI API calls are secured through Supabase Edge Functions with user authentication and server-side rate limiting:

#### Architecture
1. **Server-Side API Key**: OpenAI API key is stored as a Supabase secret - never exposed to the client
2. **Supabase Edge Functions**: All OpenAI calls are proxied through secure Edge Functions
3. **JWT Authentication**: Every request is verified using Supabase JWT tokens
4. **Server-Side Rate Limiting**: Rate limits enforced in the database (not client-side)

#### Edge Functions
- `openai-chat`: Handles chat completions (recipe generation, text parsing, image parsing)
- `openai-transcribe`: Handles audio transcription (Whisper API for voice input)

#### Rate Limit Details
- **50 requests per hour** per authenticated user
- Rate limits stored in `api_rate_limits` table in PostgreSQL
- Atomic operations prevent race conditions
- Rate limit info returned with every response

#### Protected Endpoints
- Recipe generation (single and meal plans)
- Recipe import from URLs
- Recipe import from text
- Voice transcription (Whisper API)
- Image parsing (GPT-4o Vision)

#### Session Management
The secure API client automatically refreshes JWT tokens before each API call to prevent "Session expired" errors:
- Before every API call, `refreshSession()` is called to get fresh tokens
- This ensures tokens are always valid when sent to Edge Functions
- If refresh fails, the cached session is checked as a fallback
- Users only see "Session expired" if both fresh and cached tokens are invalid

#### Error Handling
When users hit rate limits or authentication issues:
- Clear error messages are shown
- Time until rate limit reset is displayed
- Users are prompted to log in if not authenticated

### Supabase Edge Functions Setup

To enable AI recipe generation, you must deploy the Supabase Edge Functions:

#### 1. Install Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# npm
npm install -g supabase

# or use npx
npx supabase
```

#### 2. Link Your Project
```bash
# Login to Supabase
supabase login

# Link to your project (get project ref from dashboard URL)
supabase link --project-ref your-project-ref
```

#### 3. Set Server Secrets
```bash
# CRITICAL: Set your Supabase Anon Key (required for JWT verification)
# Get this from Supabase Dashboard > Settings > API > Project API keys > anon public
# Note: Use PROJECT_ANON_KEY (not SUPABASE_ANON_KEY - that prefix is reserved)
supabase secrets set PROJECT_ANON_KEY=your-anon-key-here

# Set your OpenAI API key as a server secret
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key

# Verify secrets are set (should show both)
supabase secrets list
```

**IMPORTANT**: The `PROJECT_ANON_KEY` must match the `EXPO_PUBLIC_SUPABASE_ANON_KEY` in your app's environment variables. This is required for JWT token verification in Edge Functions.

#### 4. Run Database Migration
Create the rate limits table by running this SQL in your Supabase SQL Editor:

```sql
-- Create api_rate_limits table for server-side rate limiting
CREATE TABLE IF NOT EXISTS api_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start ON api_rate_limits(window_start);

-- Enable Row Level Security
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (used by Edge Functions)
CREATE POLICY "Service role can manage rate limits"
  ON api_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Users can only read their own rate limit
CREATE POLICY "Users can read own rate limit"
  ON api_rate_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

#### 5. Deploy Edge Functions
```bash
# Deploy all functions
supabase functions deploy openai-chat
supabase functions deploy openai-transcribe

# Or deploy all at once
supabase functions deploy
```

#### 6. Verify Deployment
After deployment, your Edge Functions will be available at:
- `https://your-project-ref.supabase.co/functions/v1/openai-chat`
- `https://your-project-ref.supabase.co/functions/v1/openai-transcribe

The app will automatically use these endpoints through `supabase.functions.invoke()`.

#### Local Development
For local testing with Edge Functions:
```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve --env-file .env.local
```

Create `.env.local` for local secrets:
```
OPENAI_API_KEY=sk-your-openai-api-key
```

### Duration Options
When generating recipes, you can choose from several duration options:
- **Single Recipe**: Generate one recipe at a time
- **3 Days**: Generate 3 days worth of meals
- **1 Week**: Generate 7 unique recipes for a week of meals
- **Custom**: Select a custom date range with the calendar picker

### Meal Type Display
When viewing generated recipes:
- Each recipe shows a **color-coded meal type badge** (Breakfast, Lunch, Dinner, or Snack)
- **Breakfast** recipes display an amber/yellow badge
- **Lunch** recipes display an orange badge
- **Dinner** recipes display an indigo/purple badge
- **Snack** recipes display an emerald/green badge
- Recipes are **automatically sorted by meal type order**: Breakfast → Lunch → Dinner → Snack

### Regenerate Individual Recipes
When generating a meal plan, each recipe in the preview has a regenerate button (circular refresh icon on the right). If you don't like a particular recipe:
1. Tap the regenerate button next to that recipe
2. A new recipe will be generated to replace it
3. All other recipes in your plan remain unchanged
4. The new recipe will be different from all existing recipes in your plan

### Grocery Optimization
When generating meal plans (3+ days), you can enable **Optimize Grocery Shopping** to:
- Use shared ingredients across multiple recipes (e.g., one chicken for several meals)
- Reduce food waste by planning recipes that use similar produce, proteins, and pantry items
- Save money by minimizing unique, single-use ingredients
- Simplify grocery shopping with overlapping ingredient lists

This feature is enabled by default for meal plans and instructs the AI to design recipes that share common proteins, vegetables, grains, herbs, and pantry staples.

### Recipe Images
When saving AI-generated recipes, the app automatically assigns relevant food photos from Unsplash based on the recipe name. The system matches keywords in the recipe name to high-quality food photos:
- Chicken recipes show actual chicken dish images
- Salad recipes show salad images
- Pasta, tacos, curry, and 80+ other food types are mapped to specific photos
- Each recipe gets a contextually accurate photo without requiring any API key

No configuration needed - images are automatically selected from a curated library of Unsplash food photography.

All generated recipes respect your dietary restrictions, cuisine preferences, allergies, and cooking skill level.

### Recipe Generation - Parallel Approach
The app generates recipes using **parallel API calls** - all recipes are requested simultaneously for maximum speed while guaranteeing exact count.

**How it works:**
1. When you select 4 days + 3 meals = 12 recipes, the system fires 12 API calls at once
2. Each recipe is generated with a simple, focused prompt for that specific meal type
3. Recipes cycle through your selected meal types (e.g., breakfast, lunch, dinner, breakfast, lunch, dinner...)
4. All requests complete in parallel, dramatically reducing wait time
5. Grocery optimization suggests shared ingredients across all recipes

**Benefits:**
- **Guaranteed count**: Each recipe is its own API call - you get exactly what you requested
- **Fast**: 12 recipes generate in ~4-5 seconds instead of ~36 seconds
- **Reliable**: No batching issues or AI miscounting
- **Same cost**: Same number of tokens as sequential approach

**Result**: Selecting 4 days + 3 meals generates all 12 recipes quickly and accurately.

## Recipe Import

Import recipes from social media or any website using AI-powered extraction:

### How to Import
1. Go to the Recipes tab and tap the download icon (next to the + button)
2. Choose your import method:
   - **URL/Link**: Paste a URL from Instagram, TikTok, Pinterest, YouTube, or any recipe website
   - **Text/Recipe**: Paste recipe text, ingredients list, or description directly
3. Tap "Extract Recipe" to use AI to parse the content
4. Review and edit the extracted recipe details
5. Save to your recipe collection

### Supported Sources
- Instagram posts and reels
- TikTok videos
- Pinterest pins
- YouTube videos
- Any recipe website
- Plain text recipes

## Color Theme

The app uses a warm, earthy color palette:
- **Sage**: Primary green tones (#6a7d56)
- **Terracotta**: Accent orange tones (#e46d46)
- **Cream**: Light background (#fefdfb)
- **Charcoal**: Dark mode backgrounds (#262626)

## Premium Subscription

The app supports premium subscriptions via RevenueCat, synced with Supabase for persistent user status.

### Subscription Features
- **Monthly Premium**: $4.99/month subscription
- **Premium Entitlement**: "premium" entitlement grants access to premium features
- **Cross-Platform**: Works on iOS and Android via RevenueCat
- **Persistent Status**: Subscription status synced to Supabase database

### Setup Requirements
1. **RevenueCat**: Configure via the Payments tab in Vibecode
2. **Supabase Users Table**: Run the following SQL in your Supabase SQL Editor:

```sql
-- Create users table for premium subscriptions and account management
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_expires_at TIMESTAMPTZ,
  revenuecat_customer_id TEXT,
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'paused', 'deleted')),
  paused_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_is_premium ON users(is_premium);
CREATE INDEX IF NOT EXISTS idx_users_revenuecat_customer_id ON users(revenuecat_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
```

**IMPORTANT**: The `users` table is required for the app to function properly. If users are being asked to log in every time they open the app or their data isn't being saved, make sure this table exists with proper RLS policies.

### Usage in Code
```typescript
import { useIsPremium } from '@/lib/subscription-store';

// Check premium status anywhere in your app
const isPremium = useIsPremium();

if (isPremium) {
  // Show premium features
}
```

## Account Management

Users can manage their account status in Settings:

### Pause Account
- **Subscription is paused** - billing stops during pause
- **View saved recipes** - users can still browse and view their recipe collection
- **Restricted features** - meal planning, AI recipe generation, and grocery list creation are disabled
- **Data is preserved** - all recipes, meal plans, and preferences are saved
- **Resume anytime** - restore full access with one tap
- When paused, restricted features show lock icons and "Account Paused" messages
- Users can still navigate the app and view their recipes

### Delete Account
- **Permanently removes all user data** from the database
- Deletes: recipes, meal plans, grocery items, and preferences
- User account is soft-deleted (marked as deleted for audit trail)
- After deletion, user is logged out and redirected to login screen
- **This action cannot be undone**

### Database Updates Required
Add these columns to your `users` table in Supabase:

```sql
-- Add account status columns to users table
ALTER TABLE users
ADD COLUMN account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'paused', 'deleted')),
ADD COLUMN paused_at TIMESTAMPTZ,
ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index for account status queries
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
```

### Usage in Code
```typescript
import { useAccountStatus, useIsAccountPaused } from '@/lib/subscription-store';

// Check if account is paused
const isPaused = useIsAccountPaused();

// Get full account status ('active', 'paused', or 'deleted')
const accountStatus = useAccountStatus();

// Pause/Resume/Delete account
const { pauseAccount, resumeAccount, deleteAccount } = useSubscriptionStore();

// Pause account
await pauseAccount(userId);

// Resume account
await resumeAccount(userId);

// Delete account (removes all data)
await deleteAccount(userId);
```
