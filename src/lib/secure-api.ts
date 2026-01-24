/**
 * Secure API Client
 *
 * This module provides a secure way to make OpenAI API calls via Supabase Edge Functions.
 *
 * Features:
 * 1. User authentication (requires valid Supabase session)
 * 2. Server-side rate limiting (50 requests per hour per user)
 * 3. OpenAI API key stored only on server (not exposed to client)
 *
 * All OpenAI calls are proxied through Supabase Edge Functions:
 * - openai-chat: For chat completions (including vision)
 * - openai-transcribe: For audio transcription (Whisper)
 */

import { supabase, isSupabaseConfigured } from './supabase';

interface SecureApiConfig {
  requireAuth?: boolean; // Whether to require authentication (default: true)
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  rateLimitRemaining?: number;
  resetsAt?: string;
}

interface EdgeFunctionResponse<T> {
  data?: T;
  error?: string;
  details?: string;
  rateLimitRemaining?: number;
  resetsAt?: string;
}

/**
 * Get the current user's ID
 */
async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Make a secure API call to OpenAI via Supabase Edge Function
 * The Edge Function handles authentication verification, rate limiting, and API key management
 */
export async function secureOpenAICall<T>(
  endpoint: string,
  body: Record<string, unknown>,
  config: SecureApiConfig = {}
): Promise<ApiResponse<T>> {
  const { requireAuth = true } = config;

  // Check Supabase is configured
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase is not configured. Please check your environment variables.' };
  }

  // Check authentication on client side first for better UX
  if (requireAuth) {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { error: 'Please log in to use this feature.' };
    }
    console.log(`[SecureAPI] Authenticated request from user: ${userId.slice(0, 8)}...`);
  }

  try {
    // Determine which Edge Function to use based on endpoint
    let functionName: string;
    let functionBody: Record<string, unknown>;

    if (endpoint === 'chat/completions') {
      functionName = 'openai-chat';
      functionBody = body;
    } else {
      // For any other endpoints, use chat function with endpoint info
      // This allows future expansion
      functionName = 'openai-chat';
      functionBody = { ...body, endpoint };
    }

    // CRITICAL FIX: Force refresh the session before making API calls
    // getSession() only returns cached tokens which may be expired
    // refreshSession() validates with the server and gets fresh tokens
    console.log('[SecureAPI] Refreshing session before API call...');
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.error('[SecureAPI] Session refresh failed:', refreshError.message);
      console.error('[SecureAPI] Refresh error details:', refreshError);
      // If refresh fails, try getSession as fallback (for cases where token is still valid)
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        return { error: 'Session expired. Please log in again.' };
      }
    }

    // Get the freshly refreshed session
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    // COMPREHENSIVE DEBUG LOGGING
    console.log('[SecureAPI] ===== TOKEN DEBUG INFO =====');
    console.log('[SecureAPI] Access token exists:', !!accessToken);
    console.log('[SecureAPI] Access token preview:', accessToken?.slice(0, 20) + '...');
    console.log('[SecureAPI] Access token length:', accessToken?.length);
    console.log('[SecureAPI] Session user ID:', sessionData.session?.user?.id);
    console.log('[SecureAPI] Session expires at:', sessionData.session?.expires_at);

    // Decode JWT to check expiration (without verification)
    if (accessToken) {
      try {
        const parts = accessToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const now = Math.floor(Date.now() / 1000);
          const expiresIn = payload.exp - now;
          console.log('[SecureAPI] Token expires in:', expiresIn, 'seconds');
          console.log('[SecureAPI] Token issued at:', new Date(payload.iat * 1000).toISOString());
          console.log('[SecureAPI] Token expires at:', new Date(payload.exp * 1000).toISOString());
          console.log('[SecureAPI] Token is expired:', expiresIn <= 0);
        }
      } catch (e) {
        console.error('[SecureAPI] Failed to decode JWT:', e);
      }
    }
    console.log('[SecureAPI] =============================');

    if (!accessToken) {
      console.error('[SecureAPI] No access token found');
      return { error: 'Session expired. Please log in again.' };
    }

    // Get Supabase URL and anon key from environment
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    // Call Supabase Edge Function with explicit Authorization header
    // Note: In React Native, we need to manually pass the auth header
    console.log('[SecureAPI] Calling edge function:', functionName);
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(functionBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[SecureAPI] Edge function error:', response.status, errorData);

      if (response.status === 401) {
        return { error: 'Session expired. Please log in again.' };
      }
      if (response.status === 429) {
        return { error: 'Rate limit exceeded. Please try again later.' };
      }

      return { error: errorData.error || errorData.message || 'Failed to process request. Please try again.' };
    }

    const data = await response.json() as EdgeFunctionResponse<T>;

    if (!data) {
      return { error: 'No response from server. Please try again.' };
    }

    // Check for error in response body
    if (data.error) {
      console.error('[SecureAPI] Response error:', data.error, data.details);
      return {
        error: data.details ? `${data.error}: ${data.details}` : data.error,
        rateLimitRemaining: data.rateLimitRemaining,
        resetsAt: data.resetsAt,
      };
    }

    return {
      data: data.data,
      rateLimitRemaining: data.rateLimitRemaining,
      resetsAt: data.resetsAt,
    };
  } catch (error) {
    console.error('[SecureAPI] Request error:', error);
    return { error: 'Network error. Please check your connection and try again.' };
  }
}

/**
 * Make a secure multipart form API call (for audio transcription)
 * Uses the openai-transcribe Edge Function
 */
export async function secureOpenAIFormCall<T>(
  endpoint: string,
  formData: FormData,
  config: SecureApiConfig = {}
): Promise<ApiResponse<T>> {
  const { requireAuth = true } = config;

  // Check Supabase is configured
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase is not configured. Please check your environment variables.' };
  }

  // Check authentication
  if (requireAuth) {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { error: 'Please log in to use this feature.' };
    }
    console.log(`[SecureAPI] Authenticated form request from user: ${userId.slice(0, 8)}...`);
  }

  try {
    // For audio transcription, use the dedicated Edge Function
    if (endpoint === 'audio/transcriptions') {
      // CRITICAL FIX: Force refresh the session before making API calls
      console.log('[SecureAPI] Refreshing session before form API call...');
      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error('[SecureAPI] Session refresh failed for form:', refreshError.message);
      }

      // Get the freshly refreshed session
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        console.error('[SecureAPI] No access token found for form request');
        return { error: 'Session expired. Please log in again.' };
      }

      // Call Edge Function with form data
      // The supabase client automatically includes auth headers
      const { data, error } = await supabase.functions.invoke<EdgeFunctionResponse<T>>('openai-transcribe', {
        body: formData,
      });

      if (error) {
        console.error('[SecureAPI] Edge function form error:', error);

        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          return { error: 'Session expired. Please log in again.' };
        }
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          return { error: 'Rate limit exceeded. Please try again later.' };
        }

        return { error: error.message || 'Failed to process request. Please try again.' };
      }

      if (!data) {
        return { error: 'No response from server. Please try again.' };
      }

      if (data.error) {
        return {
          error: data.error,
          rateLimitRemaining: data.rateLimitRemaining,
          resetsAt: data.resetsAt,
        };
      }

      return {
        data: data.data,
        rateLimitRemaining: data.rateLimitRemaining,
        resetsAt: data.resetsAt,
      };
    }

    // Fallback for other form endpoints (shouldn't happen currently)
    return { error: 'Unsupported endpoint for form data.' };
  } catch (error) {
    console.error('[SecureAPI] Form request error:', error);
    return { error: 'Network error. Please check your connection and try again.' };
  }
}

/**
 * Get current rate limit status from server
 * Note: This makes an API call, so use sparingly
 */
export async function getRateLimitStatus(): Promise<{
  remaining: number;
  total: number;
  resetsAt: Date | null;
}> {
  // Default values if we can't get status
  const defaultStatus = {
    remaining: 50,
    total: 50,
    resetsAt: null,
  };

  if (!isSupabaseConfigured()) {
    return defaultStatus;
  }

  // We don't have a dedicated endpoint for this, so return default
  // The rate limit info comes back with each API response
  return defaultStatus;
}

/**
 * Check if user is authenticated for API calls
 */
export async function isAuthenticatedForApi(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return userId !== null;
}
