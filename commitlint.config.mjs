export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: { parserOpts: { issuePrefixes: ['AB#'] } },
  rules: {
    'scope-empty': [2, 'never'],
    'references-empty': [2, 'never'],
  },
};
