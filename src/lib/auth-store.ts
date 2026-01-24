import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from './supabase';
import type { User, Session } from '@supabase/supabase-js';
import { useSubscriptionStore } from './subscription-store';

/**
 * AUTH ARCHITECTURE:
 *
 * SEPARATE FLOWS:
 * - signUp(): Uses supabase.auth.signUp() for new accounts. Detects duplicate emails and returns clear error.
 * - login(): Uses supabase.auth.signInWithPassword() for existing accounts. Never calls signUp().
 *
 * DUPLICATE EMAIL HANDLING:
 * - If signUp() gets "user already exists" error, returns: "Account already exists with this email. Please log in instead."
 * - UI automatically redirects to login screen after showing error.
 * - NEVER creates duplicate user accounts.
 *
 * SESSION ROUTING:
 * - initialize(): Checks supabase.auth.getSession() on app startup.
 * - If session exists with valid access_token => route to Home (/(tabs))
 * - If no session => route to Login (/login)
 * - Listens to supabase.auth.onAuthStateChange() to keep UI in sync.
 *
 * PERSISTENCE:
 * - Supabase client configured with AsyncStorage for session persistence.
 * - Users stay logged in across app restarts (autoRefreshToken: true).
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface AuthStore {
  // Hydration
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Auth state
  currentUser: AuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // OTP state for password reset
  otpEmail: string | null;
  otpSessionId: string | null;
  isPasswordResetFlow: boolean; // Track if user is in password reset flow

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordResetOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (otp: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithOTP: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  clearOTPState: () => void;
  logout: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

const mapSupabaseUser = (user: User): AuthUser => ({
  id: user.id,
  email: user.email || '',
  name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
  createdAt: user.created_at,
});

/**
 * Ensures a user entry exists in the users table.
 * This is a fallback in case the database trigger fails.
 * Includes comprehensive logging for debugging.
 */
const ensureUserTableEntry = async (
  userId: string,
  email: string,
  name: string
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    console.warn('[Auth] Supabase not configured - skipping user table entry');
    return;
  }

  try {
    console.log('[Auth] Ensuring user table entry exists for:', userId);

    // First check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected for new users
      console.error('[Auth] Error checking for existing user:', checkError);
    }

    if (existingUser) {
      console.log('[Auth] User already exists in users table:', userId);
      return;
    }

    // User doesn't exist, create entry
    console.log('[Auth] Creating user entry in users table:', {
      userId,
      email,
      name,
      timestamp: new Date().toISOString(),
    });

    const { error: insertError } = await supabase.from('users').insert({
      id: userId,
      email: email,
      name: name,
      is_premium: false,
      account_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[Auth] Error creating user entry:', {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId,
        email,
      });

      // If it's a duplicate key error, the trigger might have created it
      if (insertError.code === '23505') {
        console.log('[Auth] User entry was created by trigger (duplicate key)');
        return;
      }

      throw insertError;
    }

    console.log('[Auth] Successfully created user entry in users table:', {
      userId,
      email,
      name,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Auth] Failed to ensure user table entry:', {
      error,
      userId,
      email,
      name,
      timestamp: new Date().toISOString(),
    });
    // Don't throw - we don't want to block the signup flow
    // The user can still use the app, and we can retry later
  }
};

export const useAuthStore = create<AuthStore>()((set, get) => ({
  // Hydration
  _hasHydrated: false,
  setHasHydrated: (state) => set({ _hasHydrated: state }),

  // Initial state
  currentUser: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  otpEmail: null,
  otpSessionId: null,
  isPasswordResetFlow: false,

  // Initialize - check for existing session
  initialize: async () => {
    if (!isSupabaseConfigured()) {
      console.warn('[Auth] Supabase not configured - auth disabled');
      set({ _hasHydrated: true, isLoading: false });
      return;
    }

    try {
      console.log('[Auth] Initializing - checking for existing session...');
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[Auth] Error getting session:', error.message);
        // Clear any stale session data on error
        set({
          _hasHydrated: true,
          isLoading: false,
          session: null,
          currentUser: null,
          isAuthenticated: false,
        });
        return;
      }

      // Only initialize subscription if we have a VALID session with access token
      if (session?.user && session?.access_token) {
        console.log('[Auth] Found valid session for user:', session.user.id);
        const authUser = mapSupabaseUser(session.user);
        set({
          session,
          currentUser: authUser,
          isAuthenticated: true,
          _hasHydrated: true,
          isLoading: false,
        });

        // Initialize subscription for existing session
        console.log('[Auth] Initializing subscription for existing user...');
        useSubscriptionStore.getState().initializeSubscription(
          authUser.id,
          authUser.email,
          authUser.name
        );
      } else {
        console.log('[Auth] No valid session found');
        set({
          _hasHydrated: true,
          isLoading: false,
          session: null,
          currentUser: null,
          isAuthenticated: false,
        });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] Auth state changed:', event, session?.user?.id);

        // Skip INITIAL_SESSION if we already handled it above
        if (event === 'INITIAL_SESSION') {
          return;
        }

        // Only update state for meaningful auth events
        // Ignore TOKEN_REFRESHED to prevent brief unauthenticated states
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Just update the session, keep authenticated state
          set({
            session,
            currentUser: mapSupabaseUser(session.user),
          });
          return;
        }

        // Handle SIGNED_IN event - this is when user logs in or signs up
        // NOTE: We do NOT call initializeSubscription here because it's already
        // called from signUp() and login() functions. Calling it twice causes race conditions.
        if (event === 'SIGNED_IN' && session?.user && session?.access_token) {
          console.log('[Auth] User signed in:', session.user.id);
          const authUser = mapSupabaseUser(session.user);
          set({
            session,
            currentUser: authUser,
            isAuthenticated: true,
          });
          // Do NOT initialize subscription here - it's handled by signUp/login
          return;
        }

        if (session?.user && session?.access_token) {
          console.log('[Auth] User session active:', session.user.id);
          set({
            session,
            currentUser: mapSupabaseUser(session.user),
            isAuthenticated: true,
          });
        } else if (event === 'SIGNED_OUT') {
          console.log('[Auth] User signed out');
          // Only clear auth on explicit sign out
          set({
            session: null,
            currentUser: null,
            isAuthenticated: false,
          });
        }
      });
    } catch (error) {
      console.error('[Auth] Auth initialization error:', error);
      set({
        _hasHydrated: true,
        isLoading: false,
        session: null,
        currentUser: null,
        isAuthenticated: false,
      });
    }
  },

  // Sign up
  signUp: async (email, password, name) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured. Please add your credentials in the ENV tab.' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validation
    if (!normalizedEmail || !password || !name.trim()) {
      return { success: false, error: 'All fields are required' };
    }

    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    try {
      // CRITICAL: First check if email already exists by attempting to sign in
      // This is necessary because Supabase's signUp() with email confirmation disabled
      // will return the existing user instead of an error, which causes duplicate profile issues
      console.log('[Auth] Checking if email already exists:', normalizedEmail);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      // If sign in succeeds, user already exists - don't allow "signup"
      if (!signInError) {
        console.log('[Auth] Email already exists - user signed in with correct password');
        // Sign them out so they don't get auto-logged in
        await supabase.auth.signOut();
        return { success: false, error: 'Account already exists with this email. Please log in instead.' };
      }

      // If error is "Invalid login credentials", it could mean:
      // 1. User exists but wrong password (most common)
      // 2. User doesn't exist at all
      // We need to differentiate these cases
      if (signInError.message.includes('Invalid login credentials')) {
        // Try signing in with a deliberately wrong password to check if user exists
        // If user exists, we'll get the same error. If not, behavior may differ.
        // Better approach: use a recovery flow check
        console.log('[Auth] Checking if email is registered via password reset...');

        // Use OTP sign-in to check if email exists (won't send email if user doesn't exist on some configs)
        // Most reliable: check if signUp returns an existing user vs new user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: name.trim(),
            },
          },
        });

        if (signUpError) {
          const errorMessage = signUpError.message.toLowerCase();
          if (errorMessage.includes('already registered') ||
              errorMessage.includes('user already exists') ||
              errorMessage.includes('email already')) {
            return { success: false, error: 'Account already exists with this email. Please log in instead.' };
          }
          return { success: false, error: signUpError.message };
        }

        // CRITICAL CHECK: When email confirmation is disabled and user already exists,
        // Supabase returns the existing user but with NO session (identities array may be empty)
        // A truly new user will have identities populated
        if (signUpData.user) {
          const identities = signUpData.user.identities || [];

          // If identities is empty or user was created before (check created_at vs now)
          // it means this is an existing user, not a new signup
          if (identities.length === 0) {
            console.log('[Auth] User already exists (no identities returned) - blocking signup');
            return { success: false, error: 'Account already exists with this email. Please log in instead.' };
          }

          // Check if user was just created (within last 10 seconds)
          const createdAt = new Date(signUpData.user.created_at);
          const now = new Date();
          const timeDiff = now.getTime() - createdAt.getTime();

          if (timeDiff > 10000) {
            // User was created more than 10 seconds ago - this is an existing user
            console.log('[Auth] User already exists (created_at is old) - blocking signup');
            // Sign out any session that might have been created
            await supabase.auth.signOut();
            return { success: false, error: 'Account already exists with this email. Please log in instead.' };
          }

          // This is a genuinely new user
          console.log('[Auth] New user created successfully:', signUpData.user.id);
          const authUser = mapSupabaseUser(signUpData.user);

          // Ensure user entry exists in users table (fallback if trigger fails)
          await ensureUserTableEntry(authUser.id, authUser.email, authUser.name);

          set({
            session: signUpData.session,
            currentUser: authUser,
            isAuthenticated: true,
          });

          // Initialize subscription for new user
          useSubscriptionStore.getState().initializeSubscription(
            authUser.id,
            authUser.email,
            authUser.name
          );

          return { success: true };
        }

        return { success: false, error: 'Sign up failed. Please try again.' };
      }

      // Other sign-in errors - proceed with signup attempt as user likely doesn't exist
      return { success: false, error: signInError.message };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  },

  // Login
  login: async (email, password) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured. Please add your credentials in the ENV tab.' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const authUser = mapSupabaseUser(data.user);
        set({
          session: data.session,
          currentUser: authUser,
          isAuthenticated: true,
        });

        // Initialize subscription on login
        useSubscriptionStore.getState().initializeSubscription(
          authUser.id,
          authUser.email,
          authUser.name
        );

        return { success: true };
      }

      return { success: false, error: 'Login failed. Please try again.' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  },

  // Send OTP for password reset
  sendPasswordResetOTP: async (email: string) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured. Please add your credentials in the ENV tab.' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail) {
      return { success: false, error: 'Email is required' };
    }

    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      return { success: false, error: 'Please enter a valid email address' };
    }

    try {
      console.log('[Auth] Sending OTP to:', normalizedEmail);

      // Use signInWithOtp with the OTP method - this sends a numeric OTP via email
      const { data, error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false, // Don't create user if doesn't exist
          emailRedirectTo: undefined, // No redirect needed for OTP
        },
      });

      if (error) {
        console.error('[Auth] OTP send error:', error.message);
        console.error('[Auth] Full error:', error);

        // Check if it's an email configuration issue
        if (error.message.includes('email') || error.message.includes('provider')) {
          return {
            success: false,
            error: 'Email sending is not configured in Supabase. Please contact support to set up email authentication.'
          };
        }

        return { success: false, error: error.message };
      }

      // Store email for OTP verification and mark as password reset flow
      set({
        otpEmail: normalizedEmail,
        otpSessionId: normalizedEmail,
        isPasswordResetFlow: true,
      });

      console.log('[Auth] OTP sent successfully to email');
      console.log('[Auth] Data:', data);
      return { success: true };
    } catch (error) {
      console.error('[Auth] Send OTP error:', error);
      return { success: false, error: 'An unexpected error occurred while sending OTP' };
    }
  },

  // Verify OTP
  verifyOTP: async (otp: string) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured.' };
    }

    const state = get();
    if (!state.otpEmail) {
      return { success: false, error: 'No email found for OTP verification' };
    }

    if (!otp || otp.length !== 8) {
      return { success: false, error: 'OTP must be 8 digits' };
    }

    try {
      console.log('[Auth] Verifying OTP...');

      const { data, error } = await supabase.auth.verifyOtp({
        email: state.otpEmail,
        token: otp,
        type: 'email',
      });

      if (error) {
        console.error('[Auth] OTP verification error:', error.message);
        return { success: false, error: error.message };
      }

      if (data.session) {
        console.log('[Auth] OTP verified successfully');
        // Store session for password reset but don't set isAuthenticated
        // This prevents auto-redirect to main app during password reset flow
        set({
          session: data.session,
          otpSessionId: data.session.access_token,
          // Keep isAuthenticated as false during password reset flow
        });
        return { success: true };
      }

      return { success: false, error: 'OTP verification failed' };
    } catch (error) {
      console.error('[Auth] Verify OTP error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  },

  // Reset password with OTP
  resetPasswordWithOTP: async (newPassword: string) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured.' };
    }

    const state = get();
    if (!state.session) {
      return { success: false, error: 'No active session for password reset' };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    try {
      console.log('[Auth] Resetting password...');

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[Auth] Password reset error:', error.message);
        return { success: false, error: error.message };
      }

      console.log('[Auth] Password reset successfully');

      // Sign out the user after password reset so they can log in fresh
      await supabase.auth.signOut();

      // Clear all OTP and session state
      set({
        otpEmail: null,
        otpSessionId: null,
        isPasswordResetFlow: false,
        session: null,
        currentUser: null,
        isAuthenticated: false,
      });

      return { success: true };
    } catch (error) {
      console.error('[Auth] Reset password error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  },

  // Clear OTP state
  clearOTPState: () => {
    set({
      otpEmail: null,
      otpSessionId: null,
      isPasswordResetFlow: false,
    });
  },

  // Logout
  logout: async () => {
    if (!isSupabaseConfigured()) {
      set({
        session: null,
        currentUser: null,
        isAuthenticated: false,
      });
      useSubscriptionStore.getState().clearSubscription();
      return;
    }

    try {
      await supabase.auth.signOut();
      set({
        session: null,
        currentUser: null,
        isAuthenticated: false,
      });
      useSubscriptionStore.getState().clearSubscription();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if server logout fails
      set({
        session: null,
        currentUser: null,
        isAuthenticated: false,
      });
      useSubscriptionStore.getState().clearSubscription();
    }
  },

  // Set session (for auth state changes)
  setSession: (session) => {
    if (session?.user) {
      set({
        session,
        currentUser: mapSupabaseUser(session.user),
        isAuthenticated: true,
      });
    } else {
      set({
        session: null,
        currentUser: null,
        isAuthenticated: false,
      });
    }
  },
}));
