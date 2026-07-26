/**
 * nativeOAuth.ts
 *
 * Complete manual PKCE OAuth flow for Android native (Capacitor).
 *
 * WHY THIS EXISTS:
 * ────────────────
 * Amplify v6's signInWithRedirect has a hard constraint:
 *   getRedirectUrl() checks window.location.origin against redirectSignIn array.
 *   On Android WebView, origin = "http://localhost".
 *   So the redirect_uri sent to Cognito is "http://localhost".
 *
 * Problem: Cognito's Hosted UI opens Google OAuth in a Chrome Custom Tab.
 * After the user authenticates, Cognito redirects the Custom Tab to:
 *   http://localhost?code=...
 * Chrome Custom Tab cannot reach Capacitor's internal local server → ERR_CONNECTION_REFUSED.
 *
 * FIX: Use dostwheels://callback as the actual redirect_uri.
 * Android intercepts this custom scheme via intent-filter → fires appUrlOpen.
 * We then exchange the code manually (one POST to Cognito /oauth2/token).
 * After exchanging, we store the tokens in Amplify's localStorage format so
 * fetchAuthSession() / getAWSCredentials() continue to work normally.
 */

import { Capacitor } from "@capacitor/core";
import { AWS_CONFIG } from "./aws-config";

// ─── Constants ────────────────────────────────────────────────────────────────
const CLIENT_ID = AWS_CONFIG.userPoolClientId;
const COGNITO_DOMAIN = AWS_CONFIG.cognitoDomain;
const REDIRECT_URI = "dostwheels://callback";
const TOKEN_ENDPOINT = `https://${COGNITO_DOMAIN}/oauth2/token`;

// localStorage keys for our PKCE state (kept separate from Amplify's keys)
const KEY_VERIFIER = "dw_native_oauth_verifier";
const KEY_STATE = "dw_native_oauth_state";

// ─── Amplify v6 token storage keys ───────────────────────────────────────────
// These mirror what Amplify v6 (aws-amplify@6.x) stores in localStorage.
// Amplify reads these on startup via fetchAuthSession() / getCurrentUser().
//
// Key format (Amplify v6 Cognito provider):
//   CognitoIdentityServiceProvider.{clientId}.LastAuthUser
//   CognitoIdentityServiceProvider.{clientId}.{username}.accessToken
//   CognitoIdentityServiceProvider.{clientId}.{username}.idToken
//   CognitoIdentityServiceProvider.{clientId}.{username}.refreshToken
//   CognitoIdentityServiceProvider.{clientId}.{username}.clockDrift
//   CognitoIdentityServiceProvider.{clientId}.{username}.userData
const PREFIX = `CognitoIdentityServiceProvider.${CLIENT_ID}`;

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function base64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(hash);
}

function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr.buffer);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true when running on Android native (Capacitor).
 * Use this to choose between native flow and Amplify's web flow.
 */
export const isNativeAndroid = (): boolean => Capacitor.isNativePlatform();

/**
 * Step 1 — Open the Cognito Hosted UI in a Chrome Custom Tab.
 *
 * Generates a PKCE verifier + challenge, stores the verifier in localStorage,
 * and opens the Cognito authorize endpoint via @capacitor/browser.
 *
 * Cognito will redirect to dostwheels://callback?code=...&state=... after auth.
 * The Android intent-filter in AndroidManifest.xml catches this and fires appUrlOpen.
 */
export async function startNativeGoogleSignIn(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  localStorage.setItem(KEY_VERIFIER, verifier);
  localStorage.setItem(KEY_STATE, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "email openid profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    identity_provider: "Google",
    // Force Google to always show the account picker.
    // Without this, Google auto-selects the account if the user has only
    // one active session, bypassing account selection entirely.
    prompt: "select_account",
  });

  const authUrl = `https://${COGNITO_DOMAIN}/oauth2/authorize?${params}`;

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: authUrl });
}

/**
 * Step 2 — Exchange the authorization code for Cognito tokens.
 *
 * Called from the appUrlOpen handler after Android intercepts dostwheels://callback.
 * Performs the PKCE token exchange directly with Cognito (bypassing Amplify's
 * internal exchange, which would use the wrong redirect_uri).
 *
 * Returns an object compatible with Amplify's AuthUser interface.
 */
export interface NativeAuthResult {
  userId: string;
  email: string;
  name: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export async function exchangeNativeOAuthCode(
  code: string,
  incomingState: string
): Promise<NativeAuthResult> {
  // Validate state to prevent CSRF
  const storedState = localStorage.getItem(KEY_STATE);
  if (incomingState !== storedState) {
    throw new Error("OAuth state mismatch — possible CSRF attempt.");
  }

  const verifier = localStorage.getItem(KEY_VERIFIER);
  if (!verifier) {
    throw new Error("PKCE code verifier not found. Please try signing in again.");
  }

  // Exchange code for tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
    code_verifier: verifier,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[nativeOAuth] token exchange failed:", errText);
    throw new Error("Failed to exchange authorization code. Please try again.");
  }

  const tokens = await response.json() as {
    access_token: string;
    id_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  // Clean up PKCE state
  localStorage.removeItem(KEY_VERIFIER);
  localStorage.removeItem(KEY_STATE);

  // Decode the ID token payload (base64url → JSON, no signature verification needed here)
  const payload = decodeJwtPayload(tokens.id_token);
  const userId: string = payload.sub ?? "";
  const email: string = (payload.email as string) ?? "";
  const name: string =
    (payload.name as string) ||
    [(payload.given_name as string), (payload.family_name as string)]
      .filter(Boolean)
      .join(" ") ||
    email.split("@")[0] ||
    "User";

  // Inject tokens into Amplify's localStorage format so fetchAuthSession()
  // and getAWSCredentials() continue to work for DynamoDB / S3 operations.
  storeTokensForAmplify(userId, tokens.access_token, tokens.id_token, tokens.refresh_token, tokens.expires_in);

  return {
    userId,
    email,
    name,
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const [, payloadB64] = token.split(".");
    // base64url → base64
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded.padEnd(padded.length + (4 - (padded.length % 4)) % 4, "="));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Stores tokens into localStorage using the exact key format Amplify v6 expects.
 * This allows fetchAuthSession() / getCurrentUser() to work without going through
 * signInWithRedirect again.
 *
 * Amplify v6 reads these keys in:
 *   packages/auth/src/providers/cognito/tokenProvider/tokenStore.ts
 */
function storeTokensForAmplify(
  username: string,
  accessToken: string,
  idToken: string,
  refreshToken: string,
  expiresIn: number
): void {
  const clockDrift = Math.floor(Date.now() / 1000) - Math.floor(Date.now() / 1000); // 0
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;

  try {
    // Mark which user is signed in
    localStorage.setItem(`${PREFIX}.LastAuthUser`, username);

    // Store the three tokens
    localStorage.setItem(`${PREFIX}.${username}.accessToken`, accessToken);
    localStorage.setItem(`${PREFIX}.${username}.idToken`, idToken);
    localStorage.setItem(`${PREFIX}.${username}.refreshToken`, refreshToken);

    // Amplify v6 token metadata
    localStorage.setItem(`${PREFIX}.${username}.clockDrift`, String(clockDrift));
    localStorage.setItem(`${PREFIX}.${username}.expiry`, String(expiry));

    // Minimal userData object that Amplify uses internally
    localStorage.setItem(
      `${PREFIX}.${username}.userData`,
      JSON.stringify({
        UserAttributes: [],
        Username: username,
      })
    );

    console.log("[nativeOAuth] Amplify tokens stored for user:", username);
  } catch (e) {
    console.warn("[nativeOAuth] Could not store tokens for Amplify:", e);
  }
}
