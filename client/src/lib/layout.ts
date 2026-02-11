import type { DateGroup, LayoutRow, LibraryItem } from "../types/media";

function getItemDate(item: LibraryItem) {
  const dateSource = item.metadata?.capturedAt || item.createdAt;
  if (!dateSource) return null;
  const date = new Date(dateSource);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function getItemRatio(item: LibraryItem) {
  const derivedWidth = item.derived?.small?.width;
  const derivedHeight = item.derived?.small?.height;
  if (derivedWidth && derivedHeight) {
    return { ratio: derivedWidth / derivedHeight, fromDerived: true };
  }

  const width = item.metadata?.width;
  const height = item.metadata?.height;
  if (width && height) return { ratio: width / height, fromDerived: false };

  return { ratio: 1, fromDerived: false };
}

function getDisplayRatio(item: LibraryItem) {
  const { ratio, fromDerived } = getItemRatio(item);
  const orientation = item.metadata?.orientation;
  if (!fromDerived && orientation && [5, 6, 7, 8].includes(orientation)) {
    return ratio > 0 ? 1 / ratio : ratio;
  }
  return ratio;
}

export function getOrientationTransform(orientation?: number) {
  switch (orientation) {
    case 2:
      return "scaleX(-1)";
    case 3:
      return "rotate(180deg)";
    case 4:
      return "scaleY(-1)";
    case 5:
      return "rotate(90deg) scaleX(-1)";
    case 6:
      return "rotate(90deg)";
    case 7:
      return "rotate(270deg) scaleX(-1)";
    case 8:
      return "rotate(270deg)";
    default:
      return "";
  }
}

export function buildRows(items: LibraryItem[], containerWidth: number): LayoutRow[] {
  const width = containerWidth || 1200;
  const gap = 6;
  const targetHeight = 140;
  const rows: LayoutRow[] = [];
  let row: { item: LibraryItem; ratio: number }[] = [];
  let ratioSum = 0;

  const flushRow = (rowItems: { item: LibraryItem; ratio: number }[], height: number) => {
    const tiles = rowItems.map((entry) => ({
      item: entry.item,
      width: Math.round(height * entry.ratio),
      height,
    }));
    const totalWidth =
      tiles.reduce((sum, tile) => sum + tile.width, 0) + gap * (tiles.length - 1);
    const diff = Math.round(width - totalWidth);
    if (tiles.length > 0 && Math.abs(diff) > 1) {
      tiles[tiles.length - 1].width = Math.max(40, tiles[tiles.length - 1].width + diff);
    }
    rows.push({ height, tiles });
  };

  for (const item of items) {
    const ratio = Math.max(0.5, Math.min(getDisplayRatio(item), 2.8));
    row.push({ item, ratio });
    ratioSum += ratio;

    const rowHeight = (width - gap * (row.length - 1)) / ratioSum;
    if (rowHeight <= targetHeight * 1.25) {
      if (rowHeight < targetHeight * 0.7 && row.length > 1) {
        const last = row.pop();
        if (last) ratioSum -= last.ratio;
        const adjustedHeight = (width - gap * (row.length - 1)) / ratioSum;
        flushRow(row, adjustedHeight);
        row = last ? [last] : [];
        ratioSum = last ? last.ratio : 0;
      } else {
        flushRow(row, rowHeight);
        row = [];
        ratioSum = 0;
      }
    }
  }

  if (row.length > 0) {
    const avgRatio = ratioSum / row.length;
    const estimatedCount = Math.max(
      row.length,
      Math.round(width / (targetHeight * avgRatio + gap)),
    );
    const ghostCount = Math.max(0, estimatedCount - row.length);
    const totalRatio = ratioSum + ghostCount * avgRatio;
    const totalGap = gap * (row.length + ghostCount - 1);
    const available = Math.max(0, width - totalGap);
    const naturalHeight = totalRatio > 0 ? available / totalRatio : targetHeight;
    const rowHeight = Math.min(targetHeight, Math.max(targetHeight * 0.7, naturalHeight));
    const tiles = row.map((entry) => ({
      item: entry.item,
      width: Math.round(rowHeight * entry.ratio),
      height: rowHeight,
    }));
    rows.push({ height: rowHeight, tiles });
  }

  return rows;
}

export function groupByDate(items: LibraryItem[], containerWidth: number): DateGroup[] {
  const groups = new Map<string, { date: Date | null; label: string; items: LibraryItem[] }>();

  for (const item of items) {
    const date = getItemDate(item);
    const key = date ? date.toISOString().slice(0, 10) : "unknown";
    const label = date
      ? date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Unknown date";
    if (!groups.has(key)) {
      groups.set(key, { date, label, items: [] });
    }
    groups.get(key)?.items.push(item);
  }

  const sortedGroups = Array.from(groups.entries())
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.getTime() - a.date.getTime();
    });

  return sortedGroups.map((group) => {
    const sortedItems = group.items.slice().sort((a, b) => {
      const aDate = getItemDate(a)?.getTime() || 0;
      const bDate = getItemDate(b)?.getTime() || 0;
      if (aDate !== bDate) return bDate - aDate;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    });

    return {
      key: group.key,
      label: group.label,
      items: sortedItems,
      rows: buildRows(sortedItems, containerWidth),
    };
  });
}
