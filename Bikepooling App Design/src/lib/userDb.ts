import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getAWSCredentials } from "./auth";
import { AWS_CONFIG } from "./aws-config";

// ─── Types ────────────────────────────────────────────────────────────
export interface UserProfile {
  userId: string;          // Cognito sub (partition key)
  name: string;
  email: string;
  provider: "email" | "google";
  avatar?: string;
  createdAt: string;
  rides: number;
  rating: number;
}

// ─── DynamoDB client factory ──────────────────────────────────────────
async function getDocClient(): Promise<DynamoDBDocumentClient> {
  const credentials = await getAWSCredentials();
  const client = new DynamoDBClient({
    region: AWS_CONFIG.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

// ─── Create user profile ──────────────────────────────────────────────
export async function createUserProfile(
  userId: string,
  name: string,
  email: string,
  provider: "email" | "google" = "email"
): Promise<void> {
  const docClient = await getDocClient();
  const item: UserProfile = {
    userId,
    name,
    email,
    provider,
    createdAt: new Date().toISOString(),
    rides: 0,
    rating: 0,
  };
  await docClient.send(
    new PutCommand({
      TableName: AWS_CONFIG.dynamoDBTable,
      Item: item,
      // Only create if doesn't already exist
      ConditionExpression: "attribute_not_exists(userId)",
    })
  );
}

// ─── Get user profile ─────────────────────────────────────────────────
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  try {
    const docClient = await getDocClient();
    const result = await docClient.send(
      new GetCommand({
        TableName: AWS_CONFIG.dynamoDBTable,
        Key: { userId },
      })
    );
    return (result.Item as UserProfile) ?? null;
  } catch {
    return null;
  }
}

// ─── Upsert (create or return existing) ──────────────────────────────
export async function upsertUserProfile(
  userId: string,
  name: string,
  email: string,
  provider: "email" | "google" = "email"
): Promise<UserProfile> {
  // Try to get existing profile first
  const existing = await getUserProfile(userId);
  if (existing) return existing;

  // Create new profile
  await createUserProfile(userId, name, email, provider).catch((err) => {
    // Ignore ConditionalCheckFailedException — profile was just created by a concurrent call
    if (err?.name !== "ConditionalCheckFailedException") throw err;
  });

  return (await getUserProfile(userId)) ?? {
    userId, name, email, provider,
    createdAt: new Date().toISOString(),
    rides: 0,
    rating: 0,
  };
}

// ─── Update user profile ──────────────────────────────────────────────
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, "name" | "email" | "avatar">>
): Promise<void> {
  const expParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    expParts.push("#nm = :nm");
    names["#nm"] = "name";
    values[":nm"] = updates.name;
  }
  if (updates.email !== undefined) {
    expParts.push("#em = :em");
    names["#em"] = "email";
    values[":em"] = updates.email;
  }
  if (updates.avatar !== undefined) {
    expParts.push("#av = :av");
    names["#av"] = "avatar";
    values[":av"] = updates.avatar;
  }

  if (expParts.length === 0) return;

  const docClient = await getDocClient();
  await docClient.send(
    new UpdateCommand({
      TableName: AWS_CONFIG.dynamoDBTable,
      Key: { userId },
      UpdateExpression: `SET ${expParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}
