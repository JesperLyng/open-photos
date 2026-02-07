import sharp from "sharp";
import exifReader from "exif-reader";
import {MediaAsset} from "../models/media-asset.js";
import {getObjectBuffer, putObject} from "../lib/storage.js";
import {notifyUser} from "../lib/realtime.js";

const THUMBNAILS = [
    {name: "small", size: 256},
    {name: "medium", size: 1024},
];

export async function processMediaAsset(assetId) {
    const asset = await MediaAsset.findById(assetId);
    if (!asset) return;

    try {
        asset.status = "processing";
        await asset.save();

        const originalBuffer = await getObjectBuffer({key: asset.original.key});
        const image = sharp(originalBuffer);
        const metadata = await image.metadata();

        const derived = {};
        for (const thumb of THUMBNAILS) {
            const resize = await image
                .clone()
                .resize({width: thumb.size, height: thumb.size, fit: "inside"})
                .jpeg({quality: 80})
                .toBuffer({resolveWithObject: true});

            const key = `derived/${asset._id}/${thumb.name}.jpg`;
            await putObject({
                key,
                body: resize.data,
                contentType: "image/jpeg",
            });

            derived[thumb.name] = {
                key,
                width: resize.info.width,
                height: resize.info.height,
            };
        }

        let capturedAt: Date | undefined;
        if (metadata.exif) {
            try {
                const exifBuffer =
                    metadata.exif instanceof Buffer ? metadata.exif : Buffer.from(metadata.exif);
                const exif = exifReader(exifBuffer);
                const raw =
                    exif?.Photo?.DateTimeOriginal ||
                    exif?.exif?.DateTimeOriginal ||
                    exif?.exif?.DateTimeDigitized ||
                    exif?.exif?.CreateDate ||
                    exif?.image?.ModifyDate;
                if (raw) {
                    const normalized = String(raw).replace(
                        /^([0-9]{4}):([0-9]{2}):([0-9]{2})/,
                        "$1-$2-$3",
                    );
                    const parsed = new Date(normalized);
                    if (!Number.isNaN(parsed.getTime())) {
                        capturedAt = parsed;
                    }
                }
            } catch {
                capturedAt = undefined;
            }
        }

        asset.metadata = {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            capturedAt,
            cameraMake: metadata.make,
            cameraModel: metadata.model,
        };
        asset.derived = derived;
        asset.status = "ready";
        await asset.save();
        notifyUser(asset.ownerId, {type: "asset_processed", assetId: asset._id.toString()});
    } catch (error) {
        console.error("processing failed", {error, assetId: asset._id.toString()});
        asset.status = "failed";
        await asset.save();
    }
}
