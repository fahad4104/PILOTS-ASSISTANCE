type Key = string;

// مثال: نربط citation index المعروف إلى صفحة
// المفتاح: `${filename}:${index}`
const MAP: Record<Key, number> = {
  // مثال فقط:
  // "fcom_787.pdf:1112": 330,
};

export function mapCitationToPage(opts: { filename?: string; index?: number }) {
  const { filename, index } = opts;
  if (!filename || typeof index !== "number") return null;
  const k = `${filename}:${index}`;
  return MAP[k] ?? null;
}
