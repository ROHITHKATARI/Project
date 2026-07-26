import { Amplify } from "aws-amplify";
import { Capacitor } from "@capacitor/core";

// ─── AWS Configuration ─────────────────────────────────────────────────
export const AWS_CONFIG = {
  region: "ap-south-1",
  userPoolId: "ap-south-1_rUc1B0Qgv",
  userPoolClientId: "4ohoojaaagsu61v20ssakjk4ab",
  identityPoolId: "ap-south-1:f5f51eab-1741-45b0-a10a-b86979fbd09b",
  cognitoDomain: "ap-south-1ruc1b0qgv.auth.ap-south-1.amazoncognito.com",
  dynamoDBTable: "dostwheels-users",
  s3Bucket: "dostwheels-avatars",
  s3Region: "ap-south-1",
} as const;

// ─── Platform detection ────────────────────────────────────────────────
const isNative = Capacitor.isNativePlatform();

// ─── Redirect URI selection ────────────────────────────────────────────
//
// ROOT CAUSE of "signInRedirect or signOutRedirect had an invalid format":
//
// Amplify v6's signInWithRedirect() calls getRedirectUrl() FIRST, before
// any URL opener logic. It checks whether window.location.href STARTS WITH
// any URL in the redirectSignIn array. If no match is found, it throws the
// error immediately — the urlOpener callback is never reached.
//
// On Android WebView:   window.location.href = "http://localhost/"
// On Web dev server:    window.location.href = "http://localhost:5173/"
//
// ANDROID:
//   - redirectSignIn must include "http://localhost/" (no port — Capacitor's URL)
//   - Amplify navigates the WebView to Cognito (no urlOpener needed)
//   - User signs in on Google
//   - Cognito redirects back to "http://localhost/?code=XXX"
//   - WebView returns to our app at http://localhost/?code=XXX
//   - isOAuthCallback = true → App.tsx processGoogleSignIn() runs ✅
//
// PREREQUISITE: "http://localhost" MUST be added to the Cognito App Client's
// "Allowed callback URLs" in the AWS console. The Capacitor local server
// runs at http://localhost (port 80, no port number).
//
// WEB:
//   - redirectSignIn uses "http://localhost:5173/" (Vite dev server URL)
//   - Standard Amplify redirect flow — no changes needed

// The ORDER matters — Amplify v6 uses Array.find() so the FIRST matching entry wins.
// window.location.origin on Android Capacitor WebView = "http://localhost" (no trailing slash).
// We put "http://localhost" FIRST so Amplify picks it as the redirect_uri sent to Cognito.
// Cognito already has "http://localhost" registered (exact match) → flow succeeds.
// "http://localhost/" (with slash) is kept as a fallback for edge cases where the
// origin includes the slash, but it MUST NOT come first or Cognito will reject the request.
const redirectSignIn = isNative
  ? ["http://localhost", "http://localhost/"]
  : ["http://localhost:5173", "http://localhost:5173/"];

const redirectSignOut = isNative
  ? ["http://localhost", "http://localhost/"]
  : ["http://localhost:5173", "http://localhost:5173/"];

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: AWS_CONFIG.userPoolId,
      userPoolClientId: AWS_CONFIG.userPoolClientId,
      identityPoolId: AWS_CONFIG.identityPoolId,
      loginWith: {
        email: true,
        oauth: {
          domain: AWS_CONFIG.cognitoDomain,
          scopes: ["email", "openid", "profile"],
          redirectSignIn,
          redirectSignOut,
          responseType: "code",
          // NO urlOpener — the Android WebView navigates to Cognito and back
          // naturally. Cognito redirects to http://localhost/?code=XXX, the
          // WebView returns to our app, and Amplify processes the code.
        },
      },
    },
  },
});
