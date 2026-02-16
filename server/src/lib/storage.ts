import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export async function signUpload({ key, contentType }) {
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
}

export async function signDownload({ key, expiresIn = 60 * 5 }) {
  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

export async function putObject({ key, body, contentType }) {
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3.send(command);
}

export async function getObjectBuffer({ key }) {
  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
  });

  const response = await s3.send(command);
  if (!response.Body) {
    throw new Error(`Empty response body for key: ${key}`);
  }
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteObject({ key }) {
  const command = new DeleteObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
  });

  await s3.send(command);
}
