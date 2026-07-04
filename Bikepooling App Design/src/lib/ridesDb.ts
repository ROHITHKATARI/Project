import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { getAWSCredentials } from "./auth";
import { AWS_CONFIG } from "./aws-config";

// ─── Table name ───────────────────────────────────────────────────────
// Create this table in AWS DynamoDB Console:
//   Table name  : dostwheels-rides
//   Partition key: rideId (String)
//   GSI          : userId-index  (userId → String, projection: All)
//   Billing      : On-demand (free tier)
const RIDES_TABLE = "dostwheels-rides";

// ─── Types ────────────────────────────────────────────────────────────
export interface RidePost {
  rideId: string;         // PK (uuid)
  userId: string;         // GSI PK — Cognito sub of poster
  posterName: string;
  from: string;
  to: string;
  fromCoords?: { lat: number; lng: number };
  date: string;           // ISO date "YYYY-MM-DD"
  time: string;           // "HH:MM"
  seats: number;          // total seats offered
  seatsLeft: number;      // decremented when someone joins
  notes?: string;
  status: "open" | "full" | "cancelled";
  joinedByIds: string[];  // Cognito sub of every joiner
  joinedByNames: string[];
  createdAt: string;
  updatedAt: string;
}

export type CreateRideInput = {
  userId: string;
  posterName: string;
  from: string;
  to: string;
  fromCoords?: { lat: number; lng: number };
  date: string;
  time: string;
  seats: number;
  notes?: string;
};

export type UpdateRideInput = Partial<
  Pick<RidePost, "from" | "to" | "date" | "time" | "seats" | "notes">
>;

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

// ─── Create a ride ────────────────────────────────────────────────────
export async function createRide(input: CreateRideInput): Promise<RidePost> {
  const docClient = await getDocClient();
  const now = new Date().toISOString();
  const ride: RidePost = {
    rideId: crypto.randomUUID(),
    ...input,
    seatsLeft: input.seats,
    joinedByIds: [],
    joinedByNames: [],
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({ TableName: RIDES_TABLE, Item: ride }));
  return ride;
}

// ─── Get a ride by ID ─────────────────────────────────────────────────
export async function getRideById(rideId: string): Promise<RidePost | null> {
  try {
    const docClient = await getDocClient();
    const result = await docClient.send(
      new GetCommand({ TableName: RIDES_TABLE, Key: { rideId } })
    );
    return (result.Item as RidePost) ?? null;
  } catch {
    return null;
  }
}

// ─── Get all rides posted by a user (via GSI) ─────────────────────────
export async function getRidesByUserId(userId: string): Promise<RidePost[]> {
  try {
    const docClient = await getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: RIDES_TABLE,
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      })
    );
    const items = (result.Items as RidePost[]) ?? [];
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

// ─── Get all open rides (for Discover screen) ─────────────────────────
export async function getAllOpenRides(): Promise<RidePost[]> {
  try {
    const docClient = await getDocClient();
    const result = await docClient.send(
      new ScanCommand({
        TableName: RIDES_TABLE,
        FilterExpression: "#st = :open",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":open": "open" },
      })
    );
    const items = (result.Items as RidePost[]) ?? [];
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

// ─── Get rides a user has joined (JS filter after full scan) ──────────
export async function getJoinedRidesByUserId(
  userId: string
): Promise<RidePost[]> {
  try {
    const docClient = await getDocClient();
    const result = await docClient.send(new ScanCommand({ TableName: RIDES_TABLE }));
    const items = (result.Items as RidePost[]) ?? [];
    return items
      .filter((r) => r.joinedByIds?.includes(userId))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  } catch {
    return [];
  }
}

// ─── Update a ride ────────────────────────────────────────────────────
export async function updateRide(
  rideId: string,
  updates: UpdateRideInput
): Promise<void> {
  const expParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  if (updates.from !== undefined) {
    expParts.push("#fr = :fr");
    names["#fr"] = "from";
    values[":fr"] = updates.from;
  }
  if (updates.to !== undefined) {
    expParts.push("#to = :to");
    names["#to"] = "to";
    values[":to"] = updates.to;
  }
  if (updates.date !== undefined) {
    expParts.push("#dt = :dt");
    names["#dt"] = "date";
    values[":dt"] = updates.date;
  }
  if (updates.time !== undefined) {
    expParts.push("#tm = :tm");
    names["#tm"] = "time";
    values[":tm"] = updates.time;
  }
  if (updates.seats !== undefined) {
    expParts.push("seats = :st, seatsLeft = :sl");
    values[":st"] = updates.seats;
    values[":sl"] = updates.seats;
  }
  if (updates.notes !== undefined) {
    expParts.push("#nt = :nt");
    names["#nt"] = "notes";
    values[":nt"] = updates.notes;
  }

  // Always update the timestamp
  expParts.push("#ua = :ua");
  names["#ua"] = "updatedAt";
  values[":ua"] = new Date().toISOString();

  const docClient = await getDocClient();
  await docClient.send(
    new UpdateCommand({
      TableName: RIDES_TABLE,
      Key: { rideId },
      UpdateExpression: `SET ${expParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

// ─── Delete a ride ────────────────────────────────────────────────────
export async function deleteRide(rideId: string): Promise<void> {
  const docClient = await getDocClient();
  await docClient.send(
    new DeleteCommand({ TableName: RIDES_TABLE, Key: { rideId } })
  );
}

// ─── Join a ride (atomic decrement + append) ──────────────────────────
export async function joinRide(
  rideId: string,
  userId: string,
  userName: string
): Promise<{ success: boolean; message: string }> {
  try {
    const docClient = await getDocClient();
    await docClient.send(
      new UpdateCommand({
        TableName: RIDES_TABLE,
        Key: { rideId },
        UpdateExpression:
          "SET seatsLeft = seatsLeft - :one," +
          " joinedByIds = list_append(if_not_exists(joinedByIds, :empty), :uid)," +
          " joinedByNames = list_append(if_not_exists(joinedByNames, :empty), :uname)," +
          " #ua = :ua",
        ConditionExpression: "seatsLeft > :zero",
        ExpressionAttributeNames: { "#ua": "updatedAt" },
        ExpressionAttributeValues: {
          ":one": 1,
          ":zero": 0,
          ":uid": [userId],
          ":uname": [userName],
          ":empty": [],
          ":ua": new Date().toISOString(),
        },
      })
    );
    return { success: true, message: "You have joined the ride!" };
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === "ConditionalCheckFailedException") {
      return { success: false, message: "No seats available on this ride." };
    }
    return { success: false, message: "Failed to join. Please try again." };
  }
}
