// The literal values integration/cli/checks reads: names, patterns, limits, and tables.

export const DEPENDENCIES_POLICY = 'version = 1\nconfigurations = ["dependencies"]\n';
export const XCTEST_EXECUTION_POLICY = `version = 1
configurations = ["xctest", "xcode"]
[tools.xcode]
project = "Example.xcodeproj"
scheme = "Example"
[tools.xctest]
coverage = [{ target = "Example", percent = 80 }]
`;
export const ROUTES_POLICY = `version = 1
level = "all"
configurations = ["express"]
[tools.express]
route_files = ["routes/*.ts"]
[[scope]]
path = "api"
configurations = ["express"]
`;
export const POSTGRES_HISTORY_POLICY =
    'version = 1\nconfigurations = ["postgres"]\n[tools.squawk]\nfrozen_through = "all"\n';
export const TOOL_FAILURES_POLICY =
    'version = 1\nlevel = "all"\nconfigurations = ["configs"]\n[runner]\ntool = "mise"\n[rules]\ninstall = false\n';
export const OPENAPI_FRESH_POLICY =
    'version = 1\nconfigurations = ["express"]\n[tools.openapi]\ndocument = "openapi.json"\nproduced_by = "bun generate.ts \\"\\" \\"two words\\""\n';
export const TSCONFIG_OPTIONS_POLICY = 'version = 1\nconfigurations = ["typescript"]\n';
export const XCTEST_EXECUTION_OPTIONS = {
    stage: 'push' as const,
    skips: [],
    only: ['xctest/coverage'],
    fix: false,
    isDryRun: false,
    noCache: true,
};
export const GENERATED_DRIFT_OPTIONS = {
    stage: 'all' as const,
    skips: [],
    only: ['integrity/generated-drift'],
    fix: false,
    isDryRun: false,
};
export const ROUTES_OPTIONS = {
    stage: 'all' as const,
    skips: [],
    only: ['express/routes-tested'],
    fix: false,
    isDryRun: false,
    noCache: true,
};
export const MANIFEST = '{"private":true,"packageManager":"bun@1.3.11"}\n';
export const GENERATED = '.gspot/config/shellcheckrc';
export const CLOUDFLARE_TYPES_GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
const content = readFileSync('bindings.txt', 'utf8');
writeFileSync(process.argv[2], content);
writeFileSync('generated-note.txt', 'Generator output');
if (content === 'failure') { console.error('Types generation failed'); process.exitCode = 1; }
`;
export const DRIZZLE_MIGRATIONS_GENERATOR = String.raw`import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const schema = readFileSync('schema.txt', 'utf8');
if (schema !== 'current') {
    mkdirSync('migrations/meta', { recursive: true });
    writeFileSync('migrations/0001_change.sql', 'ALTER TABLE records ADD name text;\n');
    writeFileSync('migrations/meta/journal.json', '{"version":2}\n');
}

if (schema === 'failure') {
    console.error('Migration generation failed');
    process.exitCode = 1;
}
`;
export const OPENAPI_FRESH_GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
if (process.argv[2] !== '' || process.argv[3] !== 'two words') throw new Error('Lost command arguments');
writeFileSync('openapi.json', readFileSync('schema.json'));
writeFileSync('side-effect.txt', 'Generator output');
if (readFileSync('schema.json', 'utf8').includes('fail')) {
    console.error('Generation failed');
    process.exitCode = 1;
}
`;
export const CLOUDFLARE_TYPES_SCOPES = ['', 'workers/api'];
export const DRIZZLE_MIGRATIONS_SCOPES = ['', 'packages/db'];
export const ROUTE = 'export const users = () => [];\n';
export const ORIGINAL = 'CREATE TABLE teams (id integer PRIMARY KEY);\n';
export const PATH = 'migrations/20240201_teams.sql';
export const PINACT_STUB = `#!/usr/bin/env bun
const args = process.argv.slice(2);
if (args.includes('--version')) {
    console.log('pinact 5.0.0');
    process.exit(0);
}
if (!args.includes('--verify')) process.exit(0);
const file = Bun.file(args.at(-1));
const content = await file.text();
if (!args.includes('--check')) await Bun.write(file, 'rewritten by pinact');
if (content.includes('actions/checkout@0000000000000000000000000000000000000000')) {
    console.error('invalid action pin: broken.yml');
    process.exit(3);
}
`;
