import { account } from "./appwrite-client";
import { ID } from "appwrite";
import { createOrUpdateProfile } from "./profile-service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AnalyticsEvent, trackEvent } from "./analytics";

const HAS_LOGGED_IN_KEY = "@grovi:has_logged_in";

export interface SignUpResult {
  success: boolean;
  error?: string;
  userId?: string;
}

/**
 * Creates a new user account in Appwrite
 * @param email - User's email address
 * @param password - User's password
 * @param phone - Optional phone number
 * @returns Promise with result containing success status and optional error message
 */
export async function createAccount(
  email: string,
  password: string
): Promise<SignUpResult> {
  try {
    const userId = ID.unique();
    
    // Appwrite account.create signature: (userId, email, password, name?)
    // Note: Phone cannot be set during account creation - it must be added after session is created
    await account.create(userId, email, password, undefined);

    return {
      success: true,
      userId,
    };
  } catch (error: any) {
    // Handle Appwrite errors
    const errorMessage = error.message || "An error occurred";
    const errorCode = error.code || error.response?.code;

    // Log the actual error for debugging
    console.log("Account creation error:", { errorCode, errorMessage, error });

    // Check for duplicate email error - be more specific
    const lowerErrorMessage = errorMessage.toLowerCase();
    const isDuplicateError = 
      errorCode === 409 ||
      lowerErrorMessage.includes("user_already_exists") ||
      lowerErrorMessage.includes("user already exists") ||
      (lowerErrorMessage.includes("email") && lowerErrorMessage.includes("already exists"));

    if (isDuplicateError) {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    }

    // Handle other errors
    return {
      success: false,
      error: errorMessage || "Failed to create account. Please try again.",
    };
  }
}

/**
 * Creates a session for an existing user
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise with result containing success status and optional error message
 */
export async function createSession(
  email: string,
  password: string
): Promise<SignUpResult> {
  try {
    await account.createEmailPasswordSession(email, password);
    
    // Mark that user has logged in before
    await AsyncStorage.setItem(HAS_LOGGED_IN_KEY, "true");
    void account.get().then((user) => trackEvent(AnalyticsEvent.UserLoggedIn, {}, user.$id));

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage = error.message || "An error occurred";
    const errorCode = error.code || error.response?.code;

    // Handle rate limiting (429 - Too Many Requests)
    if (
      errorCode === 429 ||
      errorMessage.toLowerCase().includes("rate limit") ||
      errorMessage.toLowerCase().includes("too many requests") ||
      errorMessage.toLowerCase().includes("too many attempts")
    ) {
      return {
        success: false,
        error: "Too many login attempts. Please wait a few minutes before trying again.",
      };
    }

    // Handle authentication errors
    if (errorCode === 401 || errorMessage.toLowerCase().includes("invalid")) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    // Handle network errors
    if (
      errorMessage.toLowerCase().includes("network") ||
      errorMessage.toLowerCase().includes("connection") ||
      errorMessage.toLowerCase().includes("fetch")
    ) {
      return {
        success: false,
        error: "Connection error. Please try again.",
      };
    }

    return {
      success: false,
      error: errorMessage || "Failed to create session. Please try again.",
    };
  }
}

/**
 * Combined function that creates an account and establishes a session
 * @param email - User's email address
 * @param password - User's password
 * @param phone - Optional phone number (will be added after session is created)
 * @returns Promise with result containing success status and optional error message
 */
export async function signUp(
  email: string,
  password: string,
  phone?: string
): Promise<SignUpResult> {
  // First, create the account (without phone - phone must be added after session)
  const accountResult = await createAccount(email, password);
  
  if (!accountResult.success) {
    return accountResult;
  }

  // Then, create the session
  const sessionResult = await createSession(email, password);
  
  if (!sessionResult.success) {
    return {
      success: false,
      error: sessionResult.error || "Account created but failed to start session. Please sign in.",
    };
  }

  // If phone is provided, update it after session is created (now we have authentication)
  if (phone) {
    try {
      await account.updatePhone(phone, password);
    } catch (error: any) {
      // If phone update fails, don't fail the entire sign-up
      // User can add phone later via phone verification screen
      console.warn("Failed to set phone during sign-up:", error);
      // Continue with sign-up success - phone can be added later
    }
  }

  // Create/update profile in database immediately after account creation
  // This ensures profile exists right away to prevent any issues
  try {
    const user = await account.get();
    
    // Split name into firstName and lastName if name exists
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (user.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length === 1) {
        firstName = parts[0];
      } else if (parts.length > 1) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      }
    }
    
    await createOrUpdateProfile({
      userId: user.$id,
      email: user.email,
      phone: user.phone || phone || "",
      firstName,
      lastName,
      name: user.name || undefined, // Keep for backward compatibility
    });
  } catch (profileError: any) {
    // Log error but don't fail sign-up - profile can be created/updated later
    console.warn("Failed to create profile during sign-up:", profileError);
    // Continue with sign-up success - profile can be created later
  }

  // Mark that user has logged in before (sign-up creates a session)
  await AsyncStorage.setItem(HAS_LOGGED_IN_KEY, "true");
  void trackEvent(AnalyticsEvent.UserSignedUp, {}, accountResult.userId);

  return {
    success: true,
    userId: accountResult.userId,
  };
}

export interface PhoneVerificationResult {
  success: boolean;
  error?: string;
}

/**
 * Updates or adds a phone number to the authenticated user's account
 * @param phone - Phone number in E.164 format (e.g., +18761234567)
 * @param password - User's current password (required by Appwrite for security)
 * @returns Promise with result containing success status and optional error message
 */
export async function updatePhone(
  phone: string,
  password: string
): Promise<PhoneVerificationResult> {
  try {
    await account.updatePhone(phone, password);

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage = error.message || "An error occurred";
    const errorCode = error.code || error.response?.code;

    // Check for duplicate phone error
    if (
      errorCode === 409 ||
      errorMessage.toLowerCase().includes("phone_already_exists") ||
      errorMessage.toLowerCase().includes("already exists") ||
      errorMessage.toLowerCase().includes("duplicate") ||
      errorMessage.toLowerCase().includes("phone number is already")
    ) {
      return {
        success: false,
        error: "This phone number is already registered to another account",
      };
    }

    // Handle network errors
    if (
      errorMessage.toLowerCase().includes("network") ||
      errorMessage.toLowerCase().includes("connection") ||
      errorMessage.toLowerCase().includes("fetch")
    ) {
      return {
        success: false,
        error: "Connection error. Please check your internet and try again.",
      };
    }

    return {
      success: false,
      error: errorMessage || "Failed to update phone number. Please try again.",
    };
  }
}

/**
 * Sends a phone verification OTP SMS to the user's phone number
 * @returns Promise with result containing success status and optional error message
 */
export async function sendPhoneVerification(): Promise<PhoneVerificationResult> {
  try {
    await account.createPhoneVerification();

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage = error.message || "An error occurred";
    const errorCode = error.code || error.response?.code;

    // Handle rate limiting
    if (
      errorCode === 429 ||
      errorMessage.toLowerCase().includes("rate limit") ||
      errorMessage.toLowerCase().includes("too many requests")
    ) {
      return {
        success: false,
        error: "Too many requests. Please wait a moment before requesting a new code.",
      };
    }

    // Handle network errors
    if (
      errorMessage.toLowerCase().includes("network") ||
      errorMessage.toLowerCase().includes("connection") ||
      errorMessage.toLowerCase().includes("fetch")
    ) {
      return {
        success: false,
        error: "Connection error. Please check your internet and try again.",
      };
    }

    return {
      success: false,
      error: errorMessage || "Failed to send verification code. Please try again.",
    };
  }
}

/**
 * Verifies the phone number using the OTP code received via SMS
 * @param otp - The OTP code received via SMS
 * @returns Promise with result containing success status and optional error message
 */
export async function verifyPhone(otp: string): Promise<PhoneVerificationResult> {
  try {
    // Get current user to get userId
    const user = await account.get();
    
    // Verify the phone with the OTP (secret is the OTP code)
    await account.updatePhoneVerification(user.$id, otp);

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage = error.message || "An error occurred";
    const errorCode = error.code || error.response?.code;

    // Handle invalid OTP
    if (
      errorCode === 401 ||
      errorCode === 400 ||
      errorMessage.toLowerCase().includes("invalid") ||
      errorMessage.toLowerCase().includes("expired") ||
      errorMessage.toLowerCase().includes("verification")
    ) {
      return {
        success: false,
        error: "Invalid verification code. Please try again.",
      };
    }

    // Handle network errors
    if (
      errorMessage.toLowerCase().includes("network") ||
      errorMessage.toLowerCase().includes("connection") ||
      errorMessage.toLowerCase().includes("fetch")
    ) {
      return {
        success: false,
        error: "Connection error. Please check your internet and try again.",
      };
    }

    return {
      success: false,
      error: errorMessage || "Failed to verify phone number. Please try again.",
    };
  }
}

export interface LogoutResult {
  success: boolean;
  error?: string;
}

export interface AuthStatusResult {
  isAuthenticated: boolean;
  error?: string;
}

/**
 * Checks if the user has logged in before (even if currently logged out)
 * @returns Promise indicating if user has logged in before
 */
export async function hasLoggedInBefore(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(HAS_LOGGED_IN_KEY);
    return value === "true";
  } catch (error) {
    return false;
  }
}

/**
 * Checks if the user is currently authenticated
 * @returns Promise with result indicating if user is authenticated
 */
export async function checkAuthStatus(): Promise<AuthStatusResult> {
  try {
    await account.get();
    return {
      isAuthenticated: true,
    };
  } catch (error: any) {
    // If account.get() fails, user is not authenticated
    return {
      isAuthenticated: false,
    };
  }
}

/**
 * Logs out the current user by deleting their session
 * @returns Promise with result containing success status and optional error message
 */
export async function logout(): Promise<LogoutResult> {
  try {
    await account.deleteSession("current");

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage = error.message || "An error occurred";

    return {
      success: false,
      error: errorMessage || "Failed to logout. Please try again.",
    };
  }
}

export interface PasswordResetResult {
  success: boolean;
  error?: string;
}

/**
 * Sends a password reset email to the specified email address
 * Uses non-enumerating message to prevent email enumeration attacks
 * @param email - The email address to send the reset link to
 * @returns Promise with result containing success status
 * Note: Always returns success=true with a generic message to prevent enumeration
 */
export async function sendPasswordReset(email: string): Promise<PasswordResetResult> {
  try {
    // Appwrite's createRecovery will send an email if the account exists
    // We don't want to reveal whether the email exists, so we always return success
    // Note: URL must be a valid HTTP/HTTPS URL registered in Appwrite console
    // For mobile apps, use a web URL that redirects to the app via deep link
    // If not configured, Appwrite will use the default redirect URL from console settings
    const resetUrl = process.env.EXPO_PUBLIC_PASSWORD_RESET_URL;
    
    if (resetUrl) {
      await account.createRecovery(email, resetUrl);
    } else {
      // If no URL configured, Appwrite will use the default from console settings
      // This requires the URL to be set in Appwrite console under Auth settings
      await account.createRecovery(email, "");
    }

    // Always return success with generic message (non-enumerating)
    return {
      success: true,
    };
  } catch (error: any) {
    // Even on error, we return success to prevent email enumeration
    // The error could be due to the email not existing or URL not configured, but we don't reveal that
    // Silently handle - don't log to avoid exposing errors
    // Always return success with generic message
    return {
      success: true,
    };
  }
}

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

/**
 * Updates the user's name in their Appwrite account
 * @param name - The new name for the user
 * @returns Promise with result containing success status and optional error message
 */
export async function updateName(name: string): Promise<UpdateProfileResult> {
  try {
    await account.updateName(name);

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage = error.message || "An error occurred";
    const errorCode = error.code || error.response?.code;

    // Handle network errors
    if (
      errorMessage.toLowerCase().includes("network") ||
      errorMessage.toLowerCase().includes("connection") ||
      errorMessage.toLowerCase().includes("fetch")
    ) {
      return {
        success: false,
        error: "Connection error. Please check your internet and try again.",
      };
    }

    return {
      success: false,
      error: errorMessage || "Failed to update name. Please try again.",
    };
  }
}

/**
 * Updates the user's email address in their Appwrite account
 * After updating, the email verification status is reset and a verification email is sent
 * @param email - The new email address
 * @param password - User's current password (required by Appwrite for security)
 * @returns Promise with result containing success status and optional error message
 */
export async function updateEmail(
  email: string,
  password: string
): Promise<UpdateProfileResult> {
  try {
    // Update the email (this resets emailVerification to false)
    await account.updateEmail(email, password);

    // Send verification email
    // Note: URL can be empty for mobile apps - Appwrite will use default from console settings
    const verificationUrl = process.env.EXPO_PUBLIC_EMAIL_VERIFICATION_URL || "";
    try {
      await account.createEmailVerification(verificationUrl);
    } catch (verifyError: any) {
      // Log but don't fail the update - email was updated successfully
      // Verification email sending might fail due to URL configuration, but that's okay
      console.warn("Failed to send verification email:", verifyError);
    }

    return {
      success: true,
    };
  } catch (error: any) {
    const errorMessage = error.message || "An error occurred";
    const errorCode = error.code || error.response?.code;

    // Check for duplicate email error
    if (
      errorCode === 409 ||
      errorMessage.toLowerCase().includes("email_already_exists") ||
      errorMessage.toLowerCase().includes("already exists") ||
      errorMessage.toLowerCase().includes("duplicate") ||
      errorMessage.toLowerCase().includes("email is already")
    ) {
      return {
        success: false,
        error: "This email address is already registered to another account",
      };
    }

    // Handle invalid password
    if (
      errorCode === 401 ||
      errorMessage.toLowerCase().includes("invalid credentials") ||
      errorMessage.toLowerCase().includes("password")
    ) {
      return {
        success: false,
        error: "Incorrect password. Please try again.",
      };
    }

    // Handle network errors
    if (
      errorMessage.toLowerCase().includes("network") ||
      errorMessage.toLowerCase().includes("connection") ||
      errorMessage.toLowerCase().includes("fetch")
    ) {
      return {
        success: false,
        error: "Connection error. Please check your internet and try again.",
      };
    }

    return {
      success: false,
      error: errorMessage || "Failed to update email. Please try again.",
    };
  }
}
