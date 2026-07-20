// ─── Location Sharing Database ────────────────────────────────────────
// Table: dostwheels-locations
//   PK: rideId (String)
//   SK: userId (String)
// Each item stores the last known GPS position of one ride participant.
// The rider and every joiner can write their own row and read all rows.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { getAWSCredentials } from "./auth";
import { AWS_CONFIG } from "./aws-config";

const LOC_TABLE = "dostwheels-locations";

export interface ParticipantLocation {
  rideId: string;
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  updatedAt: string;   // ISO timestamp
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

// ─── Publish / update the calling user's location for a ride ─────────
export async function updateMyLocation(
  rideId: string,
  userId: string,
  userName: string,
  lat: number,
  lng: number
): Promise<void> {
  try {
    const docClient = await getDocClient();
    const item: ParticipantLocation = {
      rideId,
      userId,
      userName,
      lat,
      lng,
      updatedAt: new Date().toISOString(),
    };
    await docClient.send(new PutCommand({ TableName: LOC_TABLE, Item: item }));
  } catch (err) {
    console.error("updateMyLocation error:", err);
  }
}

// ─── Fetch all participants' last-known positions for a ride ──────────
export async function getRideLocations(
  rideId: string
): Promise<ParticipantLocation[]> {
  try {
    const docClient = await getDocClient();
    const result = await docClient.send(
      new QueryCommand({
        TableName: LOC_TABLE,
        KeyConditionExpression: "rideId = :rid",
        ExpressionAttributeValues: { ":rid": rideId },
      })
    );
    return (result.Items as ParticipantLocation[]) ?? [];
  } catch (err) {
    console.error("getRideLocations error:", err);
    return [];
  }
}
