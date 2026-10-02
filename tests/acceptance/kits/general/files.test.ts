// The configs configuration: TOML that does not parse, YAML with a duplicated key, and an environment key read after init that no template names.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { git, commitAll } from '#tests/harness/cli/git.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { script, plantedCases } from '#tests/harness/planted/cases.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { install, toolsPath, installAtLevel } from '#tests/harness/tools/install.ts';

const CONFIGS_INIT = ['init', '--yes', '--kits', 'files', '--no-runner', '--no-ci', '--no-rules', '--no-install'];

plantedCases(
    'the configs configuration',
    {
        kits: ['files'],
        modules: false,
        without: [],
        init: ['--no-runner', '--no-ci', '--no-rules', '--no-install', '--no-hooks'],
        tools: ['taplo', 'yamllint', 'dotenv-linter'],
        files: { 'scripts/a.sh': script, 'settings/clean.toml': 'a = 1\n' },
    },
    [
        {
            check: 'files/taplo-format',
            files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
            expected: {
                file: 'settings/layout.toml',
                message: 'The file is not formatted with the configured TOML settings.',
            },
            corrected: { files: { 'settings/layout.toml': 'a = 1\nb = 2\n' } },
        },
        {
            check: 'files/dotenv-linter',
            files: { '.env.example': 'PORT=3000\nport=3000\nPORT=4000\n' },
            expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
            corrected: { files: { '.env.example': 'PORT=3000\n' } },
        },
        {
            check: 'files/xmllint',
            files: { 'settings/feed.xml': '<feed><entry></feed>\n' },
            expected: {
                file: 'settings/feed.xml',
                line: 1,
                message: 'parser error : Opening and ending tag mismatch: entry line 1 and feed',
            },
            corrected: { files: { 'settings/feed.xml': '<feed><entry /></feed>\n' } },
        },
        // The plist reader is the macOS plutil.
        {
            check: 'files/plutil',
            files: { 'app/Info.plist': '<plist><dict><key>A</key></plist>\n' },
            expected: { file: 'app/Info.plist' },
            platforms: ['darwin'],
            corrected: {
                files: {
                    'app/Info.plist':
                        '<?xml version="1.0"?><plist version="1.0"><dict><key>A</key><string>value</string></dict></plist>\n',
                },
            },
        },
    ],
    (planted) => {
        test(
            'the commit stage keeps schema validation for push',
            async () => {
                const { root, environment } = planted();
                const checked = await spawnGspot(root, ['check', '--hook', 'commit', '--json'], environment);
                const ids = (JSON.parse(checked.stdout) as RunReport).checks.map((check) => check.check);
                expect(ids).not.toContain('files/v8r');
                expect(ids).toContain('files/taplo');
            },
            PLANTED_TIMEOUT_MS * 2,
        );
    },
);

test.each([
    {
        check: 'files/taplo',
        path: 'settings.toml',
        broken: 'a = 1\n[x\n',
        corrected: 'a = 1\n',
        expected: { file: 'settings.toml', line: 2 },
    },
    {
        check: 'files/yamllint',
        path: 'config.yaml',
        broken: 'key: 1\nkey: 2\n',
        corrected: '---\nkey: 1\n',
        expected: { file: 'config.yaml', line: 2, rule: 'key-duplicates' },
    },
    {
        check: 'files/env-example',
        path: '.env.example',
        broken: 'PORT=3000\n',
        corrected: 'PORT=3000\nHOST=localhost\n',
        expected: { file: 'src/server.js', line: 1, rule: 'missing-key' },
    },
])(
    'the configs configuration: $check rejects its invalid input and accepts the corrected file',
    async (scenario) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'scripts/a.sh': script,
            'settings.toml': 'a = 1\n',
            '.env.example': 'PORT=3000\n',
        });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['taplo', 'yamllint']) };
        await installAtLevel(sandbox.path, CONFIGS_INIT, environment);
        await createFileTree(sandbox.path, {
            [scenario.path]: scenario.broken,
            'src/server.js': 'const host = process.env.HOST;\nconsole.log(host, process.env.PORT);\n',
        });
        const command = ['check', '--only', scenario.check, '--json'];
        const failed = await spawnGspot(sandbox.path, command, environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks).toMatchObject([{ check: scenario.check, status: 'failed' }]);
        expect(report.checks[0]!.findings).toContainEqual(containing(scenario.expected));
        await Bun.write(join(sandbox.path, scenario.path), scenario.corrected);
        const corrected = await spawnGspot(sandbox.path, command, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: scenario.check, status: 'passed', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'Schema validation finds nested Unicode paths through the real tool',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'README.md': '# Schema validation\n',
            'schema.json': JSON.stringify({
                type: 'object',
                properties: { count: { type: 'integer' } },
                required: ['count'],
            }),
        });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['v8r']) };
        await install(sandbox.path, [...CONFIGS_INIT, '--no-hooks'], environment);
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const mapping = JSON.stringify({ pattern: 'settings/café.json', schema: 'schema.json' });
        const setting = await spawnGspot(sandbox.path, ['set', 'tools.v8r.schemas', mapping], environment);
        expect(setting.code, setting.stdout + setting.stderr).toBe(0);
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        // A conflicting authored config must not replace the generated configuration.
        await Bun.write(join(sandbox.path, '.v8rrc.yml'), 'invalid: [\n');
        const path = join(sandbox.path, 'settings/café.json');
        await Bun.write(path, JSON.stringify({ count: 'invalid' }));
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const command = ['check', '--only', 'files/v8r', '--staged', '--hook', 'push', '--json'];
        const invalid = await spawnGspot(sandbox.path, command, environment);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'files/v8r',
                status: 'failed',
                findings: [
                    containing({
                        file: 'settings/café.json',
                        message: textContaining('must be integer'),
                    }),
                ],
            },
        ]);
        await Bun.write(path, JSON.stringify({ count: 1 }));
        expect(git(sandbox.path, ['add', 'settings/café.json']).code).toBe(0);
        const valid = await spawnGspot(sandbox.path, command, environment);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        expect((JSON.parse(valid.stdout) as RunReport).checks).toMatchObject([
            { check: 'files/v8r', status: 'passed', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'The dotenv fixer corrects tracked environment files with the pinned tool',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { '.env.example': 'lowercase=value\n' });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['dotenv-linter']) };
        await install(sandbox.path, [...CONFIGS_INIT, '--no-hooks'], environment);
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const fixed = await spawnGspot(sandbox.path, ['check', '--only', 'files/dotenv-linter', '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, '.env.example')).text()).toBe('LOWERCASE=value\n');
        const checked = await spawnGspot(sandbox.path, ['check', '--only', 'files/dotenv-linter'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);
