// Full-name validation: letters (including accented Latin-1 letters like
// á é í ó ú ü ñ) plus the punctuation real names actually use — space,
// apostrophe, hyphen. Deliberately not ASCII-only: "María", "Muñoz" and
// "O'Neill" must all validate, while digits and other symbols never do.
//
// The range À-ÖØ-öø-ÿ is the standard "accented Latin-1 letters" trick: it
// walks the codepoint block but skips U+00D7 (×) and U+00F7 (÷), which sit
// in the gaps between the three sub-ranges. Explicit ranges (rather than a
// locale-dependent POSIX class or \p{L}) keep behavior identical between
// this TS check and the mirrored SQL regex in is_valid_full_name.
const NAME_LETTER = "A-Za-zÀ-ÖØ-öø-ÿ";
const NAME_PATTERN = new RegExp(`^[${NAME_LETTER}](?:[${NAME_LETTER} '-]*[${NAME_LETTER}])?$`);

export const MIN_FULL_NAME_LENGTH = 2;
export const MAX_FULL_NAME_LENGTH = 120;

/** Trims and collapses internal runs of whitespace to a single space. */
export function normalizeFullName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidFullName(raw: string): boolean {
  const value = normalizeFullName(raw);
  return value.length >= MIN_FULL_NAME_LENGTH && value.length <= MAX_FULL_NAME_LENGTH && NAME_PATTERN.test(value);
}
