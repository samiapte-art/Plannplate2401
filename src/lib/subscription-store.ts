import { create } from 'zustand';
import {
  hasEntitlement,
  getCustomerInfo,
  setUserId,
  isRevenueCatEnabled,
} from './revenuecatClient';
import {
  fetchUserSubscription,
  updateUserPremiumStatus,
  upsertUser,
  pauseUserAccount,
  resumeUserAccount,
  deleteUserAccount,
  type UserSubscription,
  type AccountStatus,
} from './database';

interface SubscriptionStore {
  // State
  isPremium: boolean;
  isLoading: boolean;
  userSubscription: UserSubscription | null;
  accountStatus: AccountStatus;
  _initializingUserId: string | null; // Track which user is being initialized

  // Actions
  initializeSubscription: (userId: string, email: string, name?: string) => Promise<void>;
  checkPremiumStatus: (userId: string) => Promise<boolean>;
  syncWithRevenueCat: (userId: string) => Promise<void>;
  clearSubscription: () => void;

  // Account Management
  pauseAccount: (userId: string) => Promise<boolean>;
  resumeAccount: (userId: string) => Promise<boolean>;
  deleteAccount: (userId: string) => Promise<boolean>;
}

export const useSubscriptionStore = create<SubscriptionStore>()((set, get) => ({
  // Initial state
  isPremium: false,
  isLoading: true,
  userSubscription: null,
  accountStatus: 'active' as AccountStatus,
  _initializingUserId: null,

  // Initialize subscription for a user
  initializeSubscription: async (userId: string, email: string, name?: string) => {
    const timestamp = new Date().toISOString();

    // RACE CONDITION PROTECTION: Check if already initializing this user
    const currentlyInitializing = get()._initializingUserId;
    if (currentlyInitializing === userId) {
      console.log(`[Subscription] ${timestamp} - SKIPPED: Already initializing user ${userId}`);
      return;
    }

    console.log(`[Subscription] ${timestamp} - START: Initializing subscription for user: ${userId}, email: ${email}`);

    // Set lock to prevent concurrent initialization
    set({ isLoading: true, _initializingUserId: userId });

    try {
      // Ensure user exists in Supabase - WITH RETRY for RLS timing issues
      console.log(`[Subscription] ${timestamp} - Upserting user in database (attempt 1)...`);

      let user = await upsertUser(userId, email, name);

      // RETRY MECHANISM: If first attempt fails, wait and retry
      if (!user) {
        console.warn(`[Subscription] ${timestamp} - First upsert attempt failed, retrying after 500ms...`);
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`[Subscription] ${timestamp} - Upserting user in database (attempt 2)...`);
        user = await upsertUser(userId, email, name);

        if (!user) {
          console.warn(`[Subscription] ${timestamp} - Second upsert attempt failed, retrying after 1000ms...`);
          await new Promise(resolve => setTimeout(resolve, 1000));

          console.log(`[Subscription] ${timestamp} - Upserting user in database (attempt 3 - FINAL)...`);
          user = await upsertUser(userId, email, name);
        }
      }

      if (user) {
        console.log(`[Subscription] ${timestamp} - SUCCESS: User record created/updated: ${user.id}`);
        set({
          userSubscription: user,
          isPremium: user.isPremium,
          accountStatus: user.accountStatus || 'active',
        });
      } else {
        console.error(`[Subscription] ${timestamp} - FAILURE: Failed to create/update user record after 3 attempts`);
      }

      // Link RevenueCat to this user
      if (isRevenueCatEnabled()) {
        console.log(`[Subscription] ${timestamp} - Linking RevenueCat to user...`);
        await setUserId(userId);
      }

      // Sync subscription status with RevenueCat
      await get().syncWithRevenueCat(userId);
      console.log(`[Subscription] ${timestamp} - COMPLETE: Subscription initialization complete`);
    } catch (error) {
      console.error(`[Subscription] ${timestamp} - ERROR: Exception during subscription initialization:`, error);
    } finally {
      set({ isLoading: false, _initializingUserId: null });
    }
  },

  // Check if user has premium (from local state or refetch)
  checkPremiumStatus: async (userId: string) => {
    const { userSubscription } = get();

    // Quick check from local state
    if (userSubscription?.isPremium) {
      // Verify expiration
      if (userSubscription.premiumExpiresAt) {
        const expiresAt = new Date(userSubscription.premiumExpiresAt);
        if (expiresAt > new Date()) {
          return true;
        }
      } else {
        return true; // No expiration = lifetime or still active
      }
    }

    // Fetch fresh from database
    const subscription = await fetchUserSubscription(userId);
    if (subscription) {
      set({
        userSubscription: subscription,
        isPremium: subscription.isPremium,
        accountStatus: subscription.accountStatus || 'active',
      });
      return subscription.isPremium;
    }

    return false;
  },

  // Sync RevenueCat subscription status to Supabase
  syncWithRevenueCat: async (userId: string) => {
    if (!isRevenueCatEnabled()) {
      // If RevenueCat isn't configured, just use Supabase data
      const subscription = await fetchUserSubscription(userId);
      if (subscription) {
        set({
          userSubscription: subscription,
          isPremium: subscription.isPremium,
          accountStatus: subscription.accountStatus || 'active',
        });
      }
      return;
    }

    try {
      // Check RevenueCat entitlement
      const premiumResult = await hasEntitlement('premium');

      if (!premiumResult.ok) {
        // Fallback to Supabase data if RevenueCat fails
        const subscription = await fetchUserSubscription(userId);
        if (subscription) {
          set({
            userSubscription: subscription,
            isPremium: subscription.isPremium,
            accountStatus: subscription.accountStatus || 'active',
          });
        }
        return;
      }

      const isPremium = premiumResult.data;

      // Get expiration date from RevenueCat
      let expiresAt: string | null = null;
      let revenuecatCustomerId: string | null = null;

      const customerInfoResult = await getCustomerInfo();
      if (customerInfoResult.ok) {
        const customerInfo = customerInfoResult.data;
        revenuecatCustomerId = customerInfo.originalAppUserId;

        // Get expiration from the premium entitlement
        const premiumEntitlement = customerInfo.entitlements.active?.['premium'];
        if (premiumEntitlement?.expirationDate) {
          expiresAt = premiumEntitlement.expirationDate;
        }
      }

      // Update Supabase with RevenueCat status
      await updateUserPremiumStatus(userId, isPremium, expiresAt, revenuecatCustomerId);

      // Fetch updated user data
      const subscription = await fetchUserSubscription(userId);
      if (subscription) {
        set({
          userSubscription: subscription,
          isPremium: subscription.isPremium,
          accountStatus: subscription.accountStatus || 'active',
        });
      } else {
        set({ isPremium });
      }
    } catch (error) {
      console.error('Error syncing with RevenueCat:', error);
    }
  },

  // Clear subscription state on logout
  clearSubscription: () => {
    set({
      isPremium: false,
      isLoading: false,
      userSubscription: null,
      accountStatus: 'active',
      _initializingUserId: null,
    });
  },

  // Pause account - stops subscription, keeps data
  pauseAccount: async (userId: string) => {
    try {
      const success = await pauseUserAccount(userId);
      if (success) {
        set({ accountStatus: 'paused' });
        // Update local subscription state
        const { userSubscription } = get();
        if (userSubscription) {
          set({
            userSubscription: {
              ...userSubscription,
              accountStatus: 'paused',
              pausedAt: new Date().toISOString(),
            },
          });
        }
      }
      return success;
    } catch (error) {
      console.error('Error pausing account:', error);
      return false;
    }
  },

  // Resume account - reactivates paused account
  resumeAccount: async (userId: string) => {
    try {
      const success = await resumeUserAccount(userId);
      if (success) {
        set({ accountStatus: 'active' });
        // Update local subscription state
        const { userSubscription } = get();
        if (userSubscription) {
          set({
            userSubscription: {
              ...userSubscription,
              accountStatus: 'active',
              pausedAt: null,
            },
          });
        }
      }
      return success;
    } catch (error) {
      console.error('Error resuming account:', error);
      return false;
    }
  },

  // Delete account - removes all data permanently
  deleteAccount: async (userId: string) => {
    try {
      const success = await deleteUserAccount(userId);
      if (success) {
        set({ accountStatus: 'deleted' });
      }
      return success;
    } catch (error) {
      console.error('Error deleting account:', error);
      return false;
    }
  },
}));

// Selector hooks for optimized re-renders
export const useIsPremium = () => useSubscriptionStore((s) => s.isPremium);
export const useSubscriptionLoading = () => useSubscriptionStore((s) => s.isLoading);
export const useAccountStatus = () => useSubscriptionStore((s) => s.accountStatus);
export const useIsAccountPaused = () => useSubscriptionStore((s) => s.accountStatus === 'paused');
