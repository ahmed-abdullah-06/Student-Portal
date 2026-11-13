const TEXT_NODE = />([^<>{}\n][^<>{}\n]*[A-Za-z][^<>{}\n]*)</g;
const ATTRIBUTE = /\b(?:aria-label|placeholder|title)=["']([^"']*[A-Za-z][^"']*)["']/g;

/**
 * Extract user-visible JSX literals without requiring a Babel dependency.
 * The matcher intentionally ignores expressions, comments and CSS/class attributes.
 * Results are sorted and de-duplicated so CI output is deterministic.
 */
export function extractHardcodedStrings(source) {
  const values = [];
  for (const match of source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').matchAll(TEXT_NODE)) {
    const value = match[1].replace(/\s+/g, ' ').trim();
    if (value) values.push(value);
  }
  for (const match of source.matchAll(ATTRIBUTE)) {
    const value = match[1].replace(/\s+/g, ' ').trim();
    if (value) values.push(value);
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function extractRoutePaths(source) {
  return [...new Set([...source.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((match) => match[1]))].sort();
}
