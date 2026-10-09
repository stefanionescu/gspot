import type { InstalledScenario } from '#tests/types/harness/repository.ts';

/** A separate Git project supplies native Commitlint without initializing takeover subjects. */
export const COMMITLINT_REPOSITORY: InstalledScenario = { configurations: ['none'], dependencies: {}, files: {} };

/** Native Commitlint module filenames that were absent from the takeover declarations. */
export const COMMITLINT_TAKEOVERS = [
    { file: '.commitlintrc.mjs', source: 'export default { rules: { "type-enum": [2, "always", ["special"]] } };\n' },
    { file: '.commitlintrc.ts', source: 'export default { rules: { "type-enum": [2, "always", ["special"]] } };\n' },
    { file: '.commitlintrc.cts', source: 'module.exports = { rules: { "type-enum": [2, "always", ["special"]] } };\n' },
    { file: '.commitlintrc.mts', source: 'export default { rules: { "type-enum": [2, "always", ["special"]] } };\n' },
    {
        file: 'commitlint.config.cts',
        source: 'module.exports = { rules: { "type-enum": [2, "always", ["special"]] } };\n',
    },
    {
        file: 'commitlint.config.mts',
        source: 'export default { rules: { "type-enum": [2, "always", ["special"]] } };\n',
    },
];
