import { sanitizeText } from "./tags";

function normalizeExifValue(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    if (typeof value === "string") return sanitizeText(value);
    return value;
  }
  if (Array.isArray(value)) {
    return value.length ? normalizeExifValue(value[0]) : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) return normalizeExifValue(record.value);
    if ("numerator" in record && "denominator" in record) {
      const num = Number(record.numerator);
      const den = Number(record.denominator);
      if (!Number.isNaN(num) && !Number.isNaN(den) && den !== 0) {
        return num / den;
      }
    }
  }
  return null;
}

export function readExif(exif: Record<string, unknown> | undefined, paths: string[]) {
  if (!exif) return null;
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = exif;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = null;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    const normalized = normalizeExifValue(current);
    if (normalized !== null && normalized !== undefined) return normalized;
  }
  return null;
}

export function formatExposure(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric) || numeric <= 0) return null;
  if (numeric >= 1) return `${numeric.toFixed(1)}s`;
  return `1/${Math.round(1 / numeric)}s`;
}

export function formatAperture(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric) || numeric <= 0) return null;
  return `f/${numeric.toFixed(1)}`;
}

export function formatFocalLength(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric) || numeric <= 0) return null;
  return `${Math.round(numeric)} mm`;
}

export function formatIso(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric) || numeric <= 0) return null;
  return `ISO ${Math.round(numeric)}`;
}

export function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function displayText(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}
