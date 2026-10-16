// A reused command session must read the corrected source in its next run.
export const SOURCE_EDITS = [
    {
        language: 'swift',
        path: 'Source.swift',
        sample: 'func readSourceEntriesFromFilesNow() -> Int { 1 }\n',
        corrected: String.raw`func readLines(_ source: String) -> [String] {
    let trimmed = source.trimmingCharacters(in: .whitespaces)
    let lines = trimmed.components(separatedBy: "\n")
    return lines
}
`,
    },
    {
        language: 'bash',
        path: 'source.sh',
        sample: 'BadName() { echo ready; }\n',
        corrected: String.raw`read_lines() {
    local source="$1"
    printf "%s\n" "$source"
    printf "%s\n" "Complete"
}
`,
    },
] as const;

export const ESLINT_CRASH = {
    code: 1,
    stdout: '',
    stderr: 'Oops! Something went wrong\n',
    missing: false,
    duration: 1,
} as const;

export const ESLINT_TOOL = {
    name: 'eslint',
    installers: {},
    kind: 'program' as const,
    crash_pattern: '^Oops! Something went wrong',
} as const;

export const BASE_CHECK = {
    name: 'sandbox/diagnostic',
    command: ['tool'],
    level: 'recommended',
    stage: 'commit',
    runs: 'files',
    summary: '',
    why: '',
    help: '',
} as const;

export const FAILED_RUN = { code: 1, stdout: '', stderr: '', missing: false, duration: 1 } as const;

export const LOCATED_CHECK = {
    ...BASE_CHECK,
    output: { format: 'regex', file_type: 'path', pattern: '^(?<file>[^:]+): (?<message>.*)$' },
} as const;

export const FILELESS_CHECKS = [
    {
        ...BASE_CHECK,
        name: 'sandbox/coverage',
        output: { format: 'regex', file_type: 'path', pattern: '^ERROR: (?<message>.*)$' },
    },
    {
        ...BASE_CHECK,
        name: 'sandbox/links',
        output: { format: 'regex', file_type: 'link', pattern: '(?<file>.+)' },
    },
    { ...BASE_CHECK, name: 'sandbox/lines', output: { format: 'lines', file_type: 'path' } },
] as const;

export const WORKSPACE_SOURCE_FILES = {
    'package.json': '{"private":true,"workspaces":["apps/*","packages/*"],"dependencies":{"unused":"workspace:*"}}',
    'bun.lock': '{}',
    '.gitignore': 'node_modules/\ndist/\n',
    'apps/web/package.json': '{"name":"web","dependencies":{"core":"workspace:*"}}',
    'apps/web/main.js': 'import {value} from "core"; console.log(value);',
    'packages/core/package.json':
        '{"name":"core","type":"module","main":"value.js","dependencies":{"utility":"workspace:*"}}',
    'packages/core/value.js': 'import {suffix} from "utility"; export const value = "staged" + suffix;',
    'packages/utility/package.json':
        '{"name":"utility","type":"module","main":"value.js","dependencies":{"core":"workspace:*"}}',
    'packages/utility/value.js': 'export const suffix = " dependency";',
    'packages/unused/package.json': '{"name":"unused","type":"module"}',
    'packages/unused/private.txt': 'Unselected workspace bytes',
    'packages/unused/private.js': 'export const unused = 1;',
    'tsconfig.json':
        '{"compilerOptions":{"allowJs":true,"moduleResolution":"Bundler","module":"ESNext","paths":{"#alias/*":["packages/aliased/*"]}}}',
    'apps/web/tsconfig.json': '{"extends":"../../tsconfig.json","include":["*.js"]}',
    'apps/web/alias.js': 'import {aliasValue} from "#alias/value"; export const value = aliasValue;',
    'packages/aliased/package.json': '{"name":"aliased","type":"module"}',
    'packages/aliased/value.js': 'export const aliasValue = "alias source";',
} as const;

/** Copy and read failures name their operation after cleanup removes the scratch copy. */
export const SCRATCH_FAILURES = [
    { operation: 'copy', diagnostic: 'copyfile' },
    { operation: 'read', diagnostic: 'EISDIR' },
] as const;

/** Each correction outcome includes its exit code and resulting file bytes. */
export const FIXER_OUTCOMES = [
    {
        name: 'finding exit with original bytes',
        script: 'await Bun.write(\'source.txt\', "original"); process.exitCode = 3',
        exit_codes: [3],
        status: 'unchanged',
        after: 'original',
    },
    {
        name: 'finding exit with corrected bytes',
        script: 'await Bun.write(\'source.txt\', "corrected"); process.exitCode = 3',
        exit_codes: [3],
        status: 'changed',
        after: 'corrected',
    },
    {
        name: 'undeclared exit with partial bytes',
        script: 'await Bun.write(\'source.txt\', "partial"); process.exitCode = 4',
        exit_codes: [3],
        status: 'failed',
        after: 'partial',
        note: 'exited 4',
    },
    {
        name: 'default exit with original bytes',
        script: 'process.exitCode = 0',
        exit_codes: undefined,
        status: 'unchanged',
        after: 'original',
    },
    {
        name: 'default failure with original bytes',
        script: 'process.exitCode = 3',
        exit_codes: undefined,
        status: 'failed',
        after: 'original',
        note: 'exited 3',
    },
] as const;

// A check that fails while a file holds its first argument, and a correction that replaces that text with its second.
export const TEXT_CHECK =
    'const [, text, ...paths] = process.argv; const bodies = await Promise.all(paths.map((path) => Bun.file(path).text())); process.exitCode = bodies.some((body) => body.includes(text)) ? 1 : 0;';

export const TEXT_FIX =
    'const [, text, replacement, ...paths] = process.argv; for (const path of paths) await Bun.write(path, (await Bun.file(path).text()).replaceAll(text, replacement));';

export const HEADERS_FILE = `/*
    X-Content-Type-Options: nosniff
    Referrer-Policy: same-origin
    X-Frame-Options: DENY
`;

export const SCOPE_FINDINGS = [
    {
        check: 'supabase/service-role-key',
        root: [],
        nested: [{ file: 'apps/backend/client.ts', rule: 'admin-key' }],
    },
    {
        check: 'translations/messages',
        root: [],
        nested: [{ file: 'apps/backend/messages/de.json' }],
    },
    {
        check: 'cloudflare/security-headers',
        root: [],
        nested: [
            { file: 'apps/backend/_headers', rule: 'missing-header' },
            { file: 'apps/backend/_headers', rule: 'missing-header' },
        ],
    },
    {
        check: 'site/unused-assets',
        root: [{ file: 'assets/unused.png', rule: 'dead-asset' }],
        nested: [],
    },
] as const;

/** The native security check shared by generated-pack and output-parser cases. */
export const SEMGREP_CHECK = ['check', '--only', 'security/semgrep', '--json'] as const;

// Prints each line of the listed files that holds PENDING as file:line:text, the way grep -n -H does.
export const PENDING_NOTES_SCRIPT = String.raw`let found = false;
for (const file of process.argv.slice(1)) {
    for (const [index, line] of (await Bun.file(file).text()).split('\n').entries())
        if (line.includes('PENDING')) { console.log(file + ':' + String(index + 1) + ':' + line); found = true; }
}
process.exit(found ? 1 : 0);`;

/** Report selected paths and fail. */
export const REPORT_PROGRAM = 'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;';

export const WORKSPACE_SCOPE_CASES = [
    { scope: '', expected: [] },
    { scope: 'package', expected: ['--workspace', 'package'] },
    { scope: 'source', expected: [] },
] as const;

export const FIX_LINTER_CASES = [
    {
        configuration: 'javascript',
        tool: 'eslint',
        executable: 'eslint.js',
        path: 'sample.js',
        config: 'native.mjs',
        nativeConfiguration: 'export default [{ rules: { semi: ["error", "always"], "no-undef": "error" } }];',
        invalidConfiguration: 'throw new Error("Invalid native configuration");',
        formatter: ['--format', 'json'],
        sample: 'missing()\n',
        partial: 'missing();\n',
        corrected: 'export {};\n',
    },
    {
        configuration: 'css',
        tool: 'stylelint',
        executable: 'stylelint.mjs',
        path: 'sample.css',
        config: 'native.json',
        nativeConfiguration: JSON.stringify({ rules: { 'color-hex-length': 'short', 'property-no-unknown': true } }),
        invalidConfiguration: '{',
        formatter: ['--formatter', 'unix'],
        sample: 'a { color: #ffffff; unknown: 1; }\n',
        partial: 'a { color: #fff; unknown: 1; }\n',
        corrected: 'a { color: #fff; }\n',
    },
] as const;

export const FALSE_PATH = '2026-09-19T02: FATAL\n';

export const REAL_PATH = 'source.txt: located defect\n';

export const HEADER_FAILURE =
    "console.error('Banner: scanner 1'); console.error('Native input failed.'); process.exitCode = 1;";
