import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getAWSCredentials } from "./auth";
import { AWS_CONFIG } from "./aws-config";

// ─── Upload avatar to S3, returns the permanent public URL ───────────
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const credentials = await getAWSCredentials();

  const s3 = new S3Client({
    region: AWS_CONFIG.s3Region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

  // Always use the same key for a user — overwrites previous avatar
  const ext = file.type === "image/png" ? "png" : "jpg";
  const key = `avatars/${userId}.${ext}`;

  // Convert File → ArrayBuffer for S3
  const buffer = await file.arrayBuffer();

  await s3.send(
    new PutObjectCommand({
      Bucket: AWS_CONFIG.s3Bucket,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
      // No ACL needed — bucket policy grants public read
    })
  );

  // Return the permanent public URL (no expiry, no signing needed)
  const url = `https://${AWS_CONFIG.s3Bucket}.s3.${AWS_CONFIG.s3Region}.amazonaws.com/${key}`;

  // Bust browser cache if user re-uploads
  return `${url}?t=${Date.now()}`;
}
