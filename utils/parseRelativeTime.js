const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const TIME_UNITS = [
  { pattern: /ثاني|ثوان/, ms: SECOND },
  { pattern: /دقيق|دقائق|دقا/, ms: MINUTE },
  { pattern: /ساع/, ms: HOUR },
  { pattern: /يوم|ايام/, ms: DAY },
  { pattern: /اسبوع|اسابيع/, ms: WEEK },
  { pattern: /شهر|شهور|اشهر/, ms: MONTH },
  { pattern: /سن/, ms: YEAR },
];

function toAsciiDigits(text) {
  return text.replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS.indexOf(digit));
}

/**
 * Converts an Arabic relative time (e.g. "منذ ساعة", "منذ يومين", "منذ 3 أيام")
 * into a timestamp in milliseconds.
 * Returns null when the text cannot be understood.
 */
function parseRelativeTime(text, now = Date.now()) {
  if (!text) return null;

  const normalized = toAsciiDigits(String(text))
    .replace(/[إأآ]/g, "ا")
    .trim()
    .toLowerCase();

  const unit = TIME_UNITS.find(({ pattern }) => pattern.test(normalized));
  if (!unit) return null;

  const numberMatch = normalized.match(/\d+/);
  let amount = numberMatch ? Number(numberMatch[0]) : 1;

  // Dual forms such as "ساعتين", "يومين", "سنتين" mean exactly two.
  if (!numberMatch && /تين|ين/.test(normalized)) {
    amount = 2;
  }

  if (!Number.isFinite(amount) || amount <= 0) return null;

  return now - amount * unit.ms;
}

module.exports = {
  parseRelativeTime,
};
