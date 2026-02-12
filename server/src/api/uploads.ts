import crypto from "node:crypto";
import { signUpload } from "../lib/storage.js";
import { createMediaAsset, findDuplicateAsset } from "../services/media-service.js";
import { processMediaAsset } from "../services/processing-service.js";
import { config } from "../lib/config.js";

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
    { preHandler: [app.requireAuth] },
    async (request) => {
      const { filename, contentType, size, checksum } = request.body || {};

      if (!contentType || !filename) {
        throw app.httpErrors.badRequest("filename and contentType required");
      }

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
    { preHandler: [app.requireAuth] },
    async (request) => {
      const { key, bucket, contentType, size, filename, checksum } = request.body || {};

      if (!key || !bucket) {
        throw app.httpErrors.badRequest("key and bucket required");
      }

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

      setImmediate(() => {
        processMediaAsset(asset.id);
      });

      return {
        id: asset.id,
        status: asset.status,
      };
    },
  );
}
