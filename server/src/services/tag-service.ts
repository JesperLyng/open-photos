import {Tag} from "../models/tag.js";

function normalizeTagKey(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTags(tags) {
  const map = new Map();
  for (const tag of tags || []) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const key = normalizeTagKey(trimmed);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, trimmed.slice(0, 64));
    }
  }
  return map;
}

export async function updateTagCatalog({
  tenantId,
  beforeTags,
  afterTags,
}: {
  tenantId: string;
  beforeTags: string[];
  afterTags: string[];
}) {
  const beforeMap = normalizeTags(beforeTags);
  const afterMap = normalizeTags(afterTags);

  const beforeKeys = new Set(beforeMap.keys());
  const afterKeys = new Set(afterMap.keys());

  const toAdd = Array.from(afterKeys).filter((key) => !beforeKeys.has(key));
  const toRemove = Array.from(beforeKeys).filter((key) => !afterKeys.has(key));

  const now = new Date();

  if (toAdd.length > 0) {
    await Promise.all(
      toAdd.map((key) =>
        Tag.updateOne(
          { tenantId, key },
          {
            $setOnInsert: { tenantId, key, label: afterMap.get(key) || key },
            $set: { label: afterMap.get(key) || key, lastUsedAt: now },
            $inc: { count: 1 },
          },
          { upsert: true },
        ),
      ),
    );
  }

  if (toRemove.length > 0) {
    await Tag.updateMany({ tenantId, key: { $in: toRemove } }, { $inc: { count: -1 } });
  }

  await Tag.deleteMany({ tenantId, count: { $lte: 0 } });
}

export async function listTags({ tenantId, query, limit = 200 }) {
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  const criteria: Record<string, unknown> = { tenantId };
  if (q) {
    criteria.key = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  return Tag.find(criteria)
      .sort({count: -1, key: 1})
      .limit(limit)
      .select({key: 1, label: 1, count: 1, lastUsedAt: 1})
      .lean();
}
