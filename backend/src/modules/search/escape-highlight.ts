const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// The markers hold only "@", "/", "_", letters and digits, so HTML escaping leaves them intact.
export const highlightMarkers = (nonce: string) => ({
  start: `@@HL_${nonce}@@`,
  stop: `@@/HL_${nonce}@@`,
});

// ts_headline drops anything that looks like an HTML tag from a fragment, so `<script>` in a note
// would vanish from the snippet instead of being shown escaped. The repository swaps "<" and ">"
// for these words before ts_headline (a word, unlike punctuation, survives at a fragment edge),
// and escapeHighlight swaps them back before escaping.
export const anglePlaceholders = (nonce: string) => ({
  open: ` qlt${nonce} `,
  close: ` qgt${nonce} `,
});

// ts_headline does not escape the source text. Escape the whole headline first, then swap the
// unguessable markers for <mark>, so the only markup in the result is the one we added (SDS 8.2).
export const escapeHighlight = (headline: string, nonce: string): string => {
  const { start, stop } = highlightMarkers(nonce);
  return headline
    .replaceAll(new RegExp(` ?qlt${nonce} ?`, 'g'), '<')
    .replaceAll(new RegExp(` ?qgt${nonce} ?`, 'g'), '>')
    .replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)
    .replaceAll(start, '<mark>')
    .replaceAll(stop, '</mark>');
};
