import axe from 'axe-core';

// Runs axe-core on the whole document and returns the violations, as readable strings. jsdom has
// no layout engine, so the colour-contrast rule cannot run here; Lighthouse and the Playwright
// check cover contrast in a real browser.
export const axeViolations = async (): Promise<string[]> => {
  // jsdom starts without index.html, which declares the language (checked in static-assets.test).
  document.documentElement.lang = 'en';
  const results = await axe.run(document.documentElement, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
};
