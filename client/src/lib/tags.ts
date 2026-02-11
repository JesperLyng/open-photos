export function sanitizeText(value: string) {
  const filtered = Array.from(value).filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 && code !== 127;
  });
  return filtered.join("").replace(/\s+/g, " ").trim();
}

export function normalizeTag(value: string) {
  const cleaned = sanitizeText(value);
  return cleaned.replace(/,+/g, " ").trim();
}

export function normalizeTagKey(value: string) {
  return normalizeTag(value).toLowerCase();
}
