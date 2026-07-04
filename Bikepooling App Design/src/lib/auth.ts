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
} from "aws-amplify/auth";

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

/** Trigger Google OAuth via Cognito Hosted UI */
export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithRedirect({ provider: "Google" });
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Sign out the current user */
export async function logoutUser(): Promise<void> {
  try {
    await signOut();
  } catch (err) {
    console.error("Logout error:", err);
  }
}

/** Get the current authenticated user (returns null if not signed in) */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const user = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    return {
      userId: user.userId,
      email: attrs.email ?? user.username,
      name: attrs.name ?? attrs.email ?? user.username,
    };
  } catch {
    return null;
  }
}

/** Get current user (internal use - throws if not signed in) */
async function getAuthUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  const attrs = await fetchUserAttributes();
  return {
    userId: user.userId,
    email: attrs.email ?? user.username,
    name: attrs.name ?? attrs.email ?? user.username,
  };
}

/** Get IAM credentials from the Identity Pool (used by DynamoDB client) */
export async function getAWSCredentials() {
  const session = await fetchAuthSession();
  if (!session.credentials) {
    throw new Error("No AWS credentials available. Please sign in first.");
  }
  return session.credentials;
}
