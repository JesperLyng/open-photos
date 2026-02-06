import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {config} from "./config.js";

const s3 = new S3Client({
  region: config.s3Region,
  endpoint: config.s3Endpoint,
  credentials: {
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
  },
  forcePathStyle: true,
});

export async function signUpload({ key, contentType }) {
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3, command, {expiresIn: 60 * 5});
}
