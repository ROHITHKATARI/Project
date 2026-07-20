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
export interface Vehicle {
  vehicleId: string;        // uuid
  type: "Bike" | "Scooter" | "Car";
  make: string;             // brand e.g. "Honda", "Royal Enfield"
  model: string;            // e.g. "Classic 350"
  color: string;            // e.g. "Matte Black"
  numberPlate: string;      // required — e.g. "KA 01 AB 1234"
  year: string;             // manufacturing year — e.g. "2022"
  totalSeats: number;       // 2 for Bike/Scooter, 5 or 6 for Car
  rcNumber?: string;        // Registration Certificate number (optional)
  addedAt: string;          // ISO timestamp
}

// Derived: how many seats are available for joiners
export function availableSeats(v: Pick<Vehicle, "type" | "totalSeats">): number {
  if (v.type === "Bike" || v.type === "Scooter") return 1;
  if (v.totalSeats >= 6) return 4;
  return 3; // 5-seater
}

export interface UserProfile {
  userId: string;          // Cognito sub (partition key)
  name: string;
  email: string;
  provider: "email" | "google";
  avatar?: string;
  bio?: string;            // short user bio
  jobTitle?: string;       // e.g. "Software Engineer"
  workplace?: string;      // e.g. "Infosys, Electronic City"
  vehiclesJson?: string;   // JSON-serialised Vehicle[] (stored as single string attr)
  createdAt: string;
  rides: number;
  rating: number;
  // ── Verification ──────────────────────────────────────────────────────
  verificationStatus?: "pending" | "approved" | "rejected"; // review state
  verificationProfession?: string;                           // student / employee / entrepreneur
  verificationData?: string;                                 // JSON-serialised form data
  verificationSubmittedAt?: string;                          // ISO timestamp
}

// ─── DynamoDB client factory ──────────────────────────────────────────
async function getDocClient(forceRefresh = false): Promise<DynamoDBDocumentClient> {
  const credentials = await getAWSCredentials(forceRefresh);
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
  provider: "email" | "google" = "email",
  forceRefresh = false
): Promise<void> {
  const docClient = await getDocClient(forceRefresh);
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
  userId: string,
  forceRefresh = false
): Promise<UserProfile | null> {
  try {
    const docClient = await getDocClient(forceRefresh);
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
  provider: "email" | "google" = "email",
  forceRefresh = false
): Promise<UserProfile> {
  // Try to get existing profile first
  const existing = await getUserProfile(userId, forceRefresh);
  if (existing) return existing;

  // Create new profile (pass forceRefresh so DynamoDB gets fresh IAM creds)
  await createUserProfile(userId, name, email, provider, forceRefresh).catch((err) => {
    // Ignore ConditionalCheckFailedException — profile was just created by a concurrent call
    if (err?.name !== "ConditionalCheckFailedException") throw err;
  });

  return (await getUserProfile(userId, forceRefresh)) ?? {
    userId, name, email, provider,
    createdAt: new Date().toISOString(),
    rides: 0,
    rating: 0,
  };
}

// ─── Update user profile ──────────────────────────────────────────────
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile,
    | "name" | "email" | "avatar" | "bio" | "jobTitle" | "workplace"
    | "verificationStatus" | "verificationProfession" | "verificationData" | "verificationSubmittedAt"
  >>
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
  if (updates.bio !== undefined) {
    expParts.push("#bi = :bi");
    names["#bi"] = "bio";
    values[":bi"] = updates.bio;
  }
  if (updates.jobTitle !== undefined) {
    expParts.push("#jt = :jt");
    names["#jt"] = "jobTitle";
    values[":jt"] = updates.jobTitle;
  }
  if (updates.workplace !== undefined) {
    expParts.push("#wp = :wp");
    names["#wp"] = "workplace";
    values[":wp"] = updates.workplace;
  }

  if (updates.verificationStatus !== undefined) {
    expParts.push("#vs = :vs");
    names["#vs"] = "verificationStatus";
    values[":vs"] = updates.verificationStatus;
  }
  if (updates.verificationProfession !== undefined) {
    expParts.push("#vp = :vp");
    names["#vp"] = "verificationProfession";
    values[":vp"] = updates.verificationProfession;
  }
  if (updates.verificationData !== undefined) {
    expParts.push("#vd = :vd");
    names["#vd"] = "verificationData";
    values[":vd"] = updates.verificationData;
  }
  if (updates.verificationSubmittedAt !== undefined) {
    expParts.push("#vsa = :vsa");
    names["#vsa"] = "verificationSubmittedAt";
    values[":vsa"] = updates.verificationSubmittedAt;
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

// ─── Get user's saved vehicles ────────────────────────────────────────
export async function getUserVehicles(userId: string): Promise<Vehicle[]> {
  try {
    const profile = await getUserProfile(userId);
    if (!profile?.vehiclesJson) return [];
    return JSON.parse(profile.vehiclesJson) as Vehicle[];
  } catch {
    return [];
  }
}

// ─── Save (overwrite) user's vehicle list ─────────────────────────────
export async function saveUserVehicles(
  userId: string,
  vehicles: Vehicle[]
): Promise<void> {
  const docClient = await getDocClient();
  await docClient.send(
    new UpdateCommand({
      TableName: AWS_CONFIG.dynamoDBTable,
      Key: { userId },
      UpdateExpression: "SET #vj = :vj",
      ExpressionAttributeNames: { "#vj": "vehiclesJson" },
      ExpressionAttributeValues: { ":vj": JSON.stringify(vehicles) },
    })
  );
}
