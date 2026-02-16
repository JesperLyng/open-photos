import sharp from "sharp";
import exifReader from "exif-reader";
import {MediaAsset} from "../models/media-asset.js";
import {deleteObject, getObjectBuffer, putObject} from "../lib/storage.js";
import {notifyUser} from "../lib/realtime.js";
import {validateFileType} from "../lib/file-validation.js";

const THUMBNAILS = [
    {name: "small", size: 256},
    {name: "medium", size: 1024},
];

type ProcessOptions = {
    regenerateDerived?: boolean;
};

export async function processMediaAsset(assetId, options: ProcessOptions = {}) {
    const asset = await MediaAsset.findById(assetId);
    if (!asset) return;

    try {
        const {regenerateDerived = true} = options;
        asset.status = "processing";
        await asset.save();

        const originalBuffer = await getObjectBuffer({key: asset.original!.key});

        try {
            await validateFileType(originalBuffer, asset.original!.contentType ?? undefined);
        } catch (validationError) {
            console.error("file validation failed", {error: validationError, assetId: asset._id.toString()});
            notifyUser(asset.ownerId, {type: "asset_failed", assetId: asset._id.toString()});
            await deleteObject({key: asset.original!.key});
            await MediaAsset.findByIdAndDelete(asset._id);
            return;
        }

        const image = sharp(originalBuffer);
        const metadata = await image.metadata();
        const metadataOrientation = metadata.orientation;

        let derived = asset.derived || {};
        if (regenerateDerived) {
            derived = {};
            for (const thumb of THUMBNAILS) {
                const resize = await image
                    .clone()
                    .rotate()
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
        }

        let capturedAt: Date | undefined;
        let orientation: number | undefined = metadataOrientation;
        let exifData: Record<string, unknown> | undefined;
        if (metadata.exif) {
            try {
                const exifBuffer =
                    metadata.exif instanceof Buffer ? metadata.exif : Buffer.from(metadata.exif);
                exifData = exifReader(exifBuffer);
                const exifAny = exifData as Record<string, any>;
                const rawOrientation =
                    exifAny?.image?.Orientation ??
                    exifAny?.Image?.Orientation ??
                    exifAny?.IFD0?.Orientation ??
                    exifAny?.ifd0?.Orientation;
                const candidate =
                    typeof rawOrientation === "number"
                        ? rawOrientation
                        : rawOrientation?.value ?? rawOrientation?.[0];
                if (typeof candidate === "number" && candidate >= 1 && candidate <= 8) {
                    orientation = candidate;
                }
                const raw =
                    exifAny?.Photo?.DateTimeOriginal ||
                    exifAny?.exif?.DateTimeOriginal ||
                    exifAny?.exif?.DateTimeDigitized ||
                    exifAny?.exif?.CreateDate ||
                    exifAny?.image?.ModifyDate;
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

        const exifAnyForCamera = exifData as Record<string, any> | undefined;
        const cameraMake =
            exifAnyForCamera?.image?.Make ??
            exifAnyForCamera?.Image?.Make ??
            exifAnyForCamera?.ifd0?.Make ??
            undefined;
        const cameraModel =
            exifAnyForCamera?.image?.Model ??
            exifAnyForCamera?.Image?.Model ??
            exifAnyForCamera?.ifd0?.Model ??
            undefined;

        asset.metadata = {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            capturedAt,
            cameraMake: typeof cameraMake === "string" ? cameraMake : undefined,
            cameraModel: typeof cameraModel === "string" ? cameraModel : undefined,
            orientation,
            exif: exifData,
        };
        asset.derived = derived;
        asset.status = "ready";
        await asset.save();
        notifyUser(asset.ownerId, {type: "asset_processed", assetId: asset._id.toString()});
    } catch (error) {
        console.error("processing failed", {error, assetId: asset._id.toString()});
        notifyUser(asset.ownerId, {type: "asset_failed", assetId: asset._id.toString()});
        try {
            if (asset.original?.key) await deleteObject({key: asset.original.key});
            await MediaAsset.findByIdAndDelete(asset._id);
        } catch (cleanupError) {
            console.error("cleanup after failure failed", {error: cleanupError, assetId: asset._id.toString()});
        }
    }
}
