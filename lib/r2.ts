/**
 * Cloudflare R2 storage client (S3-compatible API).
 * CRITICAL: requestChecksumCalculation: "WHEN_REQUIRED" is required.
 * SDK >= 3.729.0 defaults to CRC32 checksums that R2 rejects (501 error).
 * Source: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
 */
import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
});
