// ─── Chat Database ────────────────────────────────────────────────────
// Table: dostwheels-chats
//   PK: rideId (String)
//   SK: messageId (String)  — format: "<timestamp>#<uuid4-short>"
//   No GSI needed; we always query by rideId.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { getAWSCredentials } from "./auth";
import { AWS_CONFIG } from "./aws-config";

const CHAT_TABLE = "dostwheels-chats";

export interface ChatMessage {
  rideId: string;
  messageId: string;   // "<ISO-timestamp>#<shortUUID>"  — sorts chronologically
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;      // ISO timestamp
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

// ─── Send a message ───────────────────────────────────────────────────
export async function sendMessage(
  rideId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<ChatMessage | null> {
  try {
    const now = new Date().toISOString();
    // messageId sorts chronologically: timestamp + random suffix
    const shortId = Math.random().toString(36).slice(2, 8);
    const messageId = `${now}#${shortId}`;

    const msg: ChatMessage = {
      rideId,
      messageId,
      senderId,
      senderName,
      text: text.trim(),
      sentAt: now,
    };

    const docClient = await getDocClient();
    await docClient.send(
      new PutCommand({ TableName: CHAT_TABLE, Item: msg })
    );
    return msg;
  } catch (err) {
    console.error("sendMessage error:", err);
    return null;
  }
}

// ─── Get messages for a ride (last 100, optional since timestamp) ─────
export async function getMessages(
  rideId: string,
  since?: string   // ISO timestamp — only fetch messages after this time
): Promise<ChatMessage[]> {
  try {
    const docClient = await getDocClient();

    const keyCondition = since
      ? "rideId = :rid AND messageId > :since"
      : "rideId = :rid";
    const exprValues: Record<string, string> = since
      ? { ":rid": rideId, ":since": since }
      : { ":rid": rideId };

    const result = await docClient.send(
      new QueryCommand({
        TableName: CHAT_TABLE,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: exprValues,
        ScanIndexForward: true,  // oldest → newest
        Limit: 100,
      })
    );
    return (result.Items as ChatMessage[]) ?? [];
  } catch (err) {
    console.error("getMessages error:", err);
    return [];
  }
}
