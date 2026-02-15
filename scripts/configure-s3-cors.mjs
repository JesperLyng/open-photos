/**
 * Configure CORS on the Scaleway S3 bucket to allow browser-based uploads.
 *
 * Usage:
 *   node scripts/run-with-env.mjs server/.prod.env node scripts/configure-s3-cors.mjs
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION;
const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error("Missing S3 environment variables. Run via run-with-env.mjs with your .prod.env.");
  process.exit(1);
}

// Always allow localhost for development
if (!allowedOrigins.includes("http://localhost:5173")) {
  allowedOrigins.push("http://localhost:5173");
}

const s3 = new S3Client({
  region: region || "fr-par",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: allowedOrigins,
      AllowedMethods: ["PUT", "GET", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ],
};

console.log(`Bucket:  ${bucket}`);
console.log(`Origins: ${allowedOrigins.join(", ")}`);
console.log(`Methods: PUT, GET, HEAD`);
console.log();

try {
  await s3.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: corsConfig }));
  console.log("CORS configuration applied successfully.");

  // Verify
  const result = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log("\nVerification — current CORS rules:");
  console.log(JSON.stringify(result.CORSRules, null, 2));
} catch (error) {
  console.error("Failed to set CORS:", error.message);
  process.exit(1);
}
