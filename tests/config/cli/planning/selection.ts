export const POLICY_PATHS = ['gspot.toml', '.gspot/config/lychee.toml'];

export const LINK_POLICY = `configurations = ["docs"]
[scope."api"]
configurations = ["docs"]
[[ignore]]
check = "docs/lychee"
paths = ["ignored/**"]
reason = "These pages are evaluated only after the documentation build."
`;

/** The SDK-only root has no app; the child app owns its complete build inputs. */
export const NEXT_BUILD_FILES = {
    'package.json': '{"dependencies":{"next":"16.3.5"}}',
    'library.ts': 'export const count = 1;\n',
    'web/package.json': '{"dependencies":{"next":"16.3.5"}}',
    'web/tsconfig.json': '{}',
    'web/src/data.ts': 'export const count = 1;\n',
};

export const NEXT_BUILD_TABLES = `[scope."web"]
configurations = ["nextjs"]
`;

/** Next.js accepts either router at the project root or under src. */
export const NEXT_BUILD_ROUTES = ['app/page.tsx', 'src/app/page.tsx', 'pages/index.tsx', 'src/pages/index.tsx'];

/** Coverage choices stay constant while language selections and the level change. */
export const AUTOMATIC_CHECKS = [
    'security/semgrep',
    'security/semgrep-registry',
    'security/codeql',
    'duplication/jscpd',
    'licenses/packages',
];

/** Empty and named manual language lists both retain common checks. */
export const MANUAL_SELECTIONS = [
    { configurations: undefined },
    { configurations: [] },
    { configurations: ['python'] },
];

export const HOOK_STAGES = [
    ['pre-commit', 'commit'],
    ['pre-push', 'push'],
] as const;

export const HOOK_STAGE_CHECKS = [
    'files/taplo',
    'files/v8r',
    'swift/swiftlint',
    'swift/build',
    'swift/swiftlint-analyze',
    'swift/periphery',
    'nginx/gixy',
    'nginx/test',
    'docs/lychee',
    'docs/lychee-external',
    'typescript/tsc',
];

export const HOOK_STAGE_FILES = {
    'source.ts': 'export const value = 1;\n',
    'guide.md': '# Guide\n',
    'settings.toml': 'enabled = true\n',
    'Sources/App/Greeting.swift': 'func greeting() {}\n',
    'nginx.conf': 'events {}\nhttp {}\n',
};

export const COVERAGE_PLUGIN_CASES = [
    ['pytest', 'recommended', 'lines'],
    ['pytest', 'recommended', 'branches'],
    ['pytest', 'recommended', 'functions'],
    ['pytest', 'recommended', 'statements'],
    ['pytest', 'recommended', 'zero'],
    ['pytest', 'all', 'lines'],
    ['pytest', 'all', 'branches'],
    ['pytest', 'all', 'functions'],
    ['pytest', 'all', 'statements'],
    ['pytest', 'all', 'zero'],
    ['vitest', 'recommended', 'lines'],
    ['vitest', 'recommended', 'branches'],
    ['vitest', 'recommended', 'functions'],
    ['vitest', 'recommended', 'statements'],
    ['vitest', 'recommended', 'zero'],
    ['vitest', 'all', 'lines'],
    ['vitest', 'all', 'branches'],
    ['vitest', 'all', 'functions'],
    ['vitest', 'all', 'statements'],
    ['vitest', 'all', 'zero'],
] as const;
