const ENGINE_SCOPES = `[[tools.eslint.override]]
paths = ["browser/**"]
runtime = "browser"
[[scope]]
path = "old"
[[scope]]
path = "new"
[[scope]]
path = "forced"
[[scope]]
path = "old/legacy"
[[scope]]
path = "browser"
`;

const ENGINE_PACKAGES = {
    'package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'old/package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'new/package.json': '{"private":true,"type":"module","engines":{"node":">=22.0.0"}}',
    'forced/package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'old/legacy/package.json': '{"private":true,"type":"module","engines":{"node":">=22.0.0"}}',
} as const;

const ENGINE_PATHS = [
    'old/source.js',
    'old/source.cjs',
    'new/source.js',
    'forced/source.js',
    'old/legacy/source.js',
    'browser/source.js',
] as const;

const ENGINE_SOURCE = 'export const grouped = Object.groupBy([1], String);\nprocess.loadEnvFile();\n';

const ENGINE_FINDINGS = [
    { ruleId: 'n/no-unsupported-features/es-builtins', line: 1 },
    { ruleId: 'n/no-unsupported-features/node-builtins', line: 2 },
] as const;

/** Package engine findings, then source corrections using supported APIs. */
const ENGINE_PHASES = [
    { reported: ['old/source.js', 'old/source.cjs', 'forced/source.js'], corrections: [] },
    { reported: [], corrections: ['old/source.js', 'old/source.cjs', 'forced/source.js'] },
] as const;

export { ENGINE_PATHS, ENGINE_SCOPES, ENGINE_PHASES, ENGINE_SOURCE, ENGINE_FINDINGS, ENGINE_PACKAGES };
