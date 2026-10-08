export const ENGINE_SCOPES =
    '[agent_rules]\nenabled = false\n[scope."old"]\n[scope."new"]\n[scope."forced"]\n[scope."old/legacy"]\n[scope."browser"]\n[scope."browser".tools.eslint.runtimes]\n"**/*" = "browser"\n';

export const ENGINE_PACKAGES = {
    'package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'old/package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'new/package.json': '{"private":true,"type":"module","engines":{"node":">=22.0.0"}}',
    'forced/package.json': '{"private":true,"type":"module","engines":{"node":">=18.0.0"}}',
    'old/legacy/package.json': '{"private":true,"type":"module","engines":{"node":">=22.0.0"}}',
};

export const ENGINE_PATHS = [
    'old/source.js',
    'old/source.cjs',
    'new/source.js',
    'forced/source.js',
    'old/legacy/source.js',
    'browser/source.js',
];

export const ENGINE_SOURCE = 'export const grouped = Object.groupBy([1], String);\nprocess.loadEnvFile();\n';

export const ENGINE_FINDINGS = [
    { ruleId: 'n/no-unsupported-features/es-builtins', line: 1, severity: 2 },
    { ruleId: 'n/no-unsupported-features/node-builtins', line: 2, severity: 2 },
];

/** Apply overrides, replace them with an inherited root override, then remove it and correct unsupported calls. */
export const ENGINE_PHASES = [
    {
        tables: '[agent_rules]\nenabled = false\n[scope."old"]\n[scope."new"]\n[scope."forced"]\n[scope."forced".tools.eslint]\nnode_version = ">=22.0.0"\n[scope."old/legacy"]\n[scope."old/legacy".tools.eslint]\nnode_version = ">=18.0.0"\n[scope."browser"]\n[scope."browser".tools.eslint.runtimes]\n"**/*" = "browser"\n',
        reported: ['old/source.js', 'old/source.cjs', 'old/legacy/source.js'],
        corrections: [],
    },
    {
        tables: ENGINE_SCOPES + '[tools.eslint]\nnode_version = ">=18.0.0"\n',
        reported: ['old/source.js', 'old/source.cjs', 'old/legacy/source.js', 'new/source.js', 'forced/source.js'],
        corrections: [],
    },
    {
        tables: ENGINE_SCOPES,
        reported: [],
        corrections: ['old/source.js', 'old/source.cjs', 'forced/source.js'],
    },
];
