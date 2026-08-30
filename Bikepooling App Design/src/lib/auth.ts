import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  confirmSignUp,
  resendSignUpCode,
  fetchAuthSession,
  fetchUserAttributes,
  signInWithRedirect,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";
import { Capacitor } from "@capacitor/core";
import { startNativeGoogleSignIn } from "./nativeOAuth";
import { deactivateDeviceToken } from "./deviceRegistrationDb";

// ─── Types ────────────────────────────────────────────────────────────
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

// ─── Error message helper ─────────────────────────────────────────────
function friendlyError(err: unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred.";
  const code = (err as { name?: string }).name ?? "";
  switch (code) {
    case "UsernameExistsException":
      return "An account with this email already exists. Try signing in.";
    case "NotAuthorizedException":
      return "Incorrect email or password. Please try again.";
    case "UserNotConfirmedException":
      return "Please verify your email before signing in.";
    case "UserNotFoundException":
      return "No account found with this email.";
    case "CodeMismatchException":
      return "Invalid verification code. Please check and try again.";
    case "ExpiredCodeException":
      return "Verification code has expired. Please request a new one.";
    case "InvalidPasswordException":
      return "Password must be at least 8 characters with numbers and symbols.";
    case "LimitExceededException":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "NetworkError":
      return "Network error. Please check your internet connection.";
    case "InvalidParameterException":
      return "Invalid input. Please check your details and try again.";
    default:
      return err.message || "Something went wrong. Please try again.";
  }
}

// ─── Auth functions ───────────────────────────────────────────────────

/** Register a new user with email + password */
export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<void> {
  try {
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: { name, email },
        autoSignIn: false,
      },
    });
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Confirm email with the 6-digit code sent by Cognito */
export async function confirmEmail(
  email: string,
  code: string
): Promise<void> {
  try {
    await confirmSignUp({ username: email, confirmationCode: code });
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Resend the confirmation code */
export async function resendCode(email: string): Promise<void> {
  try {
    await resendSignUpCode({ username: email });
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Sign in with email + password */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthUser> {
  try {
    await signIn({ username: email, password });
    return await getAuthUser();
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Trigger Google OAuth via Cognito Hosted UI.
 *
 * ANDROID: Uses a fully manual PKCE flow (nativeOAuth.ts) that opens
 * Cognito in @capacitor/browser with redirect_uri=dostwheels://callback.
 * This avoids ERR_CONNECTION_REFUSED which occurs when Cognito's Chrome
 * Custom Tab tries to redirect to http://localhost (unreachable externally).
 *
 * The dostwheels://callback URI is caught by the Android intent-filter
 * in AndroidManifest.xml → Capacitor fires appUrlOpen → App.tsx calls
 * exchangeNativeOAuthCode() to complete the token exchange.
 *
 * WEB: Uses Amplify's built-in signInWithRedirect (standard web flow).
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      // Native Android: manual PKCE flow via @capacitor/browser
      await startNativeGoogleSignIn();
      // Flow continues in App.tsx → appUrlOpen handler
    } else {
      // Web: standard Amplify redirect flow
      await signInWithRedirect({ provider: "Google" });
    }
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Sign out the current user and deactivate the current device token */
export async function logoutUser(): Promise<void> {
  try {
    // 1. Deactivate device registration before clearing the Cognito session
    try {
      const authUser = await getCurrentAuthUser();
      if (authUser?.userId) {
        await deactivateDeviceToken(authUser.userId);
      }
    } catch (deactivateErr) {
      console.warn("[Auth] Device deactivation non-fatal error during logout:", deactivateErr);
    }

    // 2. Sign out of Cognito
    await signOut();
  } catch (err) {
    console.error("Logout error:", err);
  }
}

/** Send a password-reset OTP to the user's email */
export async function sendPasswordResetOTP(email: string): Promise<void> {
  try {
    await resetPassword({ username: email });
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Confirm password reset with OTP + new password */
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Extract user info from ID token (all users) or attributes API (fallback) */
async function resolveUserInfo(
  user: { userId: string; username: string }
): Promise<AuthUser> {
  // Strategy 1: decode the ID token — works for ALL users (email + Google)
  // without making an API call, so no 400 errors for federated users.
  try {
    const session = await fetchAuthSession();
    const payload = session.tokens?.idToken?.payload;
    if (payload) {
      const email = (payload.email as string) ?? user.username;
      const name =
        (payload.name as string) ||
        [(payload.given_name as string), (payload.family_name as string)]
          .filter(Boolean)
          .join(" ") ||
        email.split("@")[0];
      return {
        userId: user.userId,
        email,
        name: name || "User",
      };
    }
  } catch {
    // ID token unavailable — try fetchUserAttributes next
  }

  // Strategy 2: fetchUserAttributes API (fallback for edge cases)
  try {
    const attrs = await fetchUserAttributes();
    const name =
      attrs.name ||
      [attrs.given_name, attrs.family_name].filter(Boolean).join(" ") ||
      attrs.email?.split("@")[0] ||
      user.username;
    return {
      userId: user.userId,
      email: attrs.email ?? user.username,
      name: name || "User",
    };
  } catch {
    // Also unavailable — use bare minimum
  }

  // Strategy 3: bare minimum fallback
  return {
    userId: user.userId,
    email: user.username,
    name: user.username.split("@")[0] || "User",
  };
}

/** Get the current authenticated user (returns null if not signed in) */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const user = await getCurrentUser();
    return await resolveUserInfo(user);
  } catch {
    return null;
  }
}

/** Get current user (internal use - throws if not signed in) */
async function getAuthUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  return await resolveUserInfo(user);
}

/** Get IAM credentials from the Identity Pool (used by DynamoDB client).
 *  Pass forceRefresh=true right after a Google OAuth redirect to ensure
 *  the Identity Pool has federated the fresh Cognito session.
 */
export async function getAWSCredentials(forceRefresh = false) {
  const session = await fetchAuthSession({ forceRefresh });
  if (!session.credentials) {
    // One retry with forceRefresh in case the first attempt was stale
    const retried = await fetchAuthSession({ forceRefresh: true });
    if (!retried.credentials) {
      throw new Error("No AWS credentials available. Please sign in first.");
    }
    return retried.credentials;
  }
  return session.credentials;
}
