import crypto from "node:crypto";
import { signUpload } from "../lib/storage.js";
import { createMediaAsset, findDuplicateAsset } from "../services/media-service.js";
import { config } from "../lib/config.js";
import { uploadInitSchema, uploadCompleteSchema } from "../schemas/uploads.js";
import { mediaProcessingQueue } from "../lib/queue.js";
import { processMediaAsset } from "../services/processing-service.js";
import { uploadRateLimit } from "../lib/security.js";

function randomKey(userId) {
  const id = crypto.randomUUID();
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${userId}/${yyyy}/${mm}/${dd}/${id}`;
}

export function registerUploadRoutes(app) {
  app.post(
    "/api/uploads/init",
    {
      preHandler: [app.requireAuth],
      schema: uploadInitSchema,
      config: { rateLimit: uploadRateLimit },
    },
    async (request) => {
      const { filename, contentType, size, checksum } = request.body;

      if (!config.s3Bucket) {
        throw app.httpErrors.internalServerError("storage not configured");
      }

      const duplicate = await findDuplicateAsset({
        tenantId: request.user.tenantId,
        ownerId: request.user.id,
        checksum,
        size,
      });
      if (duplicate) {
        return {
          duplicate: true,
          assetId: duplicate.id,
          status: duplicate.status,
        };
      }

      const key = randomKey(request.user.tenantId);
      const uploadUrl = await signUpload({ key, contentType });

      return {
        duplicate: false,
        uploadUrl,
        key,
        bucket: config.s3Bucket,
        contentType,
        size,
        filename,
        checksum,
      };
    },
  );

  app.post(
    "/api/uploads/complete",
    {
      preHandler: [app.requireAuth],
      schema: uploadCompleteSchema,
      config: { rateLimit: uploadRateLimit },
    },
    async (request) => {
      const { key, bucket, contentType, size, filename, checksum } = request.body;

      const asset = await createMediaAsset({
        tenantId: request.user.tenantId,
        ownerId: request.user.id,
        key,
        bucket,
        contentType,
        size,
        filename,
        checksum,
      });

      if (mediaProcessingQueue) {
        await mediaProcessingQueue.add(
          "process-media",
          {
            assetId: String(asset.id),
            tenantId: request.user.tenantId,
            ownerId: request.user.id,
          },
          { jobId: `media-${asset.id}` },
        );
      } else {
        processMediaAsset(String(asset.id)).catch((err) => {
          app.log.error(err, "inline media processing failed");
        });
      }

      return {
        id: asset.id,
        status: asset.status,
      };
    },
  );
}
