import { Amplify } from "aws-amplify";

// ─── AWS Configuration ────────────────────────────────────────────────
// Region: ap-south-1 (Mumbai)
// All values below are public config — safe to include in frontend code.
export const AWS_CONFIG = {
  region: "ap-south-1",
  userPoolId: "ap-south-1_rUc1B0Qgv",
  userPoolClientId: "4ohoojaaagsu61v20ssakjk4ab",
  identityPoolId: "ap-south-1:f5f51eab-1741-45b0-a10a-b86979fbd09b",
  cognitoDomain: "ap-south-1ruc1b0qgv.auth.ap-south-1.amazoncognito.com",
  dynamoDBTable: "dostwheels-users",
  s3Bucket: "dostwheels-avatars",   // profile picture storage
  s3Region: "ap-south-1",           // bucket region
  redirectSignIn: "http://localhost:5173/",
  redirectSignOut: "http://localhost:5173/",
} as const;

// ─── Initialize Amplify ───────────────────────────────────────────────
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
          redirectSignIn: [AWS_CONFIG.redirectSignIn],
          redirectSignOut: [AWS_CONFIG.redirectSignOut],
          responseType: "code",
        },
      },
    },
  },
});
