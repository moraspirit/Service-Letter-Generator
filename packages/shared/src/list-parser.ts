// Leading bullet markers: bullet (U+2022), "-", "*", and the Symbol-font
// private-use bullet U+F0B7 that Word/Excel produces.
const LEADING_BULLET = /^[\s•\-*]+/;

/**
 * Parses a `list` cell (spreadsheet cell or textarea) into ordered bullet strings:
 * split on line breaks, strip a leading bullet marker, drop empty lines.
 */
export function parseListCell(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(LEADING_BULLET, "").trim())
    .filter((line) => line.length > 0);
}
