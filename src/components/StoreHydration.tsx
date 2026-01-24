import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useMealPlanStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';

interface StoreHydrationProps {
  children: React.ReactNode;
}

export function StoreHydration({ children }: StoreHydrationProps) {
  const mealPlanHydrated = useMealPlanStore((s) => s._hasHydrated);
  const authHydrated = useAuthStore((s) => s._hasHydrated);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const session = useAuthStore((s) => s.session);
  const loadUserData = useMealPlanStore((s) => s.loadUserData);
  const clearAllData = useMealPlanStore((s) => s.clearAllData);
  const isSyncing = useMealPlanStore((s) => s.isSyncing);

  const [isReady, setIsReady] = useState(false);
  const [hasLoadedUserData, setHasLoadedUserData] = useState(false);
  const previousUserIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Load user data when authenticated
  const loadData = useCallback(async (userId: string) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    console.log('Loading user data for:', userId);
    try {
      await loadUserData(userId);
      setHasLoadedUserData(true);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadUserData]);

  useEffect(() => {
    const currentUserId = currentUser?.id || null;
    const hasValidSession = Boolean(session?.access_token);

    // Only load data if we have BOTH authentication state AND a valid session
    if (isAuthenticated && currentUserId && mealPlanHydrated && hasValidSession) {
      // Always load data when user logs in, even if it's the same user
      // This ensures fresh data from the database overrides stale local storage
      if (currentUserId !== previousUserIdRef.current) {
        loadData(currentUserId);
        previousUserIdRef.current = currentUserId;
      }
    }

    // User logged out or session became invalid
    if ((!isAuthenticated || !hasValidSession) && previousUserIdRef.current) {
      console.log('Clearing user data - session invalid or user logged out');
      clearAllData();
      previousUserIdRef.current = null;
      setHasLoadedUserData(false);
    }
  }, [isAuthenticated, currentUser?.id, session?.access_token, mealPlanHydrated, loadData, clearAllData]);

  useEffect(() => {
    // Wait for both stores to hydrate
    if (mealPlanHydrated && authHydrated) {
      const hasValidSession = Boolean(session?.access_token);

      // If user is authenticated WITH a valid session, wait for user data to load
      // If not authenticated or no valid session, we're ready immediately
      if (isAuthenticated && hasValidSession) {
        // Allow some time for data sync, or proceed if already synced
        if (hasLoadedUserData || !isSyncing) {
          setIsReady(true);
        }
      } else {
        setIsReady(true);
      }
    }
  }, [mealPlanHydrated, authHydrated, isAuthenticated, session?.access_token, hasLoadedUserData, isSyncing]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fefdfb' }}>
        <ActivityIndicator size="large" color="#6a7d56" />
      </View>
    );
  }

  return <>{children}</>;
}
