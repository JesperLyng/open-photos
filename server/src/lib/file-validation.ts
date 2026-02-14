import { fileTypeFromBuffer } from "file-type";
import { ALLOWED_MIME_TYPES } from "./security.js";

export async function validateFileType(
  buffer: Buffer,
  declaredContentType?: string,
): Promise<void> {
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    throw new Error(
      `Unable to detect file type from content${declaredContentType ? ` (declared: ${declaredContentType})` : ""}`,
    );
  }

  if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
    throw new Error(
      `File type ${detected.mime} is not allowed. Allowed types: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
    );
  }

  if (declaredContentType && detected.mime !== declaredContentType) {
    // Allow heic/heif mismatch since they're often confused
    const heicTypes = new Set(["image/heic", "image/heif"]);
    if (heicTypes.has(detected.mime) && heicTypes.has(declaredContentType)) {
      return;
    }

    throw new Error(
      `Declared content type ${declaredContentType} does not match detected type ${detected.mime}`,
    );
  }
}
