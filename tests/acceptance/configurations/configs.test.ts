// The configs configuration: TOML that does not parse, YAML with a duplicated key, and an environment key read after init that no template names.
import type { RunReport } from '#cli/types/reports.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { describe, expect, test } from 'bun:test';
import { chmodSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import { runPlanted, script } from '#tests/support/cli/planted.ts';
import { install, installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';

const INIT = ['init', '--yes', '--configurations', 'configs', '--no-runner', '--no-ci', '--no-rules', '--no-install'];

const WORKFLOW_HEAD =
    'name: planted\non: [push]\npermissions:\n    contents: read\njobs:\n    build:\n        runs-on: ubuntu-24.04\n        steps:\n';

const PINACT_STUB = `#!/usr/bin/env bun
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

const CASES: FindingCase[] = [
    {
        check: 'configs/toml-format',
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: {
            file: 'settings/layout.toml',
            message: 'The file is not formatted with the configured TOML settings.',
        },
    },
    {
        check: 'configs/actions',
        files: { '.github/workflows/broken.yml': `${WORKFLOW_HEAD}            - run: echo "\${{ nothing.here }}"\n` },
        expected: { file: '.github/workflows/broken.yml', rule: 'expression', line: 9, column: 30 },
    },
    {
        check: 'configs/actions-security',
        files: {
            '.github/workflows/unpinned.yml': `${WORKFLOW_HEAD}            - uses: actions/checkout@v4\n            - run: echo "\${{ github.event.pull_request.title }}"\n`,
        },
        expected: { file: '.github/workflows/unpinned.yml', rule: 'template-injection', line: 10 },
    },
    {
        check: 'configs/dotenv',
        files: { '.env.example': 'PORT=3000\nport=3000\nPORT=4000\n' },
        expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
    },
    {
        check: 'configs/xml',
        files: { 'settings/feed.xml': '<feed><entry></feed>\n' },
        expected: {
            file: 'settings/feed.xml',
            line: 1,
            message: 'parser error : Opening and ending tag mismatch: entry line 1 and feed',
        },
    },
];

describe('the configs configuration', () => {
    test(
        'a tool crash reports both output streams and its exit code',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'settings/layout.toml': 'a = 1\n',
                'bin/taplo': `#!/usr/bin/env bun
if (process.argv.includes('--version')) {
    console.log('taplo 0.10.0');
    process.exit(0);
}
console.error('INFO taplo: loaded configuration');
console.log('ERROR taplo: cannot read the formatting configuration');
process.exit(2);
`,
                'bin/taplo.cmd': '@echo off\r\nbun "%~dp0taplo" %*\r\n',
            });
            chmodSync(join(sandbox.path, 'bin/taplo'), 0o755);
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            };
            await install(
                sandbox.path,
                [...INIT.filter((arg) => arg !== '--no-runner'), '--runner', 'mise', '--no-hooks'],
                environment,
            );
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const result = await run(
                sandbox.path,
                ['check', '--only', 'configs/toml-format', '--no-cache'],
                environment,
            );
            expect(result.code, result.stderr + result.stdout).toBe(2);
            expect(result.stdout).toContain('taplo broke: exit 2');
            expect(result.stdout).toContain('INFO taplo: loaded configuration');
            expect(result.stdout).toContain('cannot read the formatting configuration');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'action pin verification reports a rejected commit and preserves the workflow',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'README.md': '# Action pins\n',
                'bin/pinact': PINACT_STUB,
                'bin/pinact.cmd': '@echo off\r\nbun "%~dp0pinact" %*\r\n',
            });
            chmodSync(join(sandbox.path, 'bin/pinact'), 0o755);
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            };
            await install(sandbox.path, [...INIT, '--no-hooks'], environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const path = join(sandbox.path, '.github/workflows/broken.yml');
            const workflow = `${WORKFLOW_HEAD}            - uses: actions/checkout@0000000000000000000000000000000000000000\n`;
            await Bun.write(path, workflow);
            const result = await run(
                sandbox.path,
                ['check', '--only', 'configs/actions-pins', '--stage', 'push', '--no-cache'],
                environment,
            );
            expect(result.code, result.stderr + result.stdout).toBe(1);
            expect(result.stdout).toContain('invalid action pin: broken.yml');
            expect(await Bun.file(path).text()).toBe(workflow);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'GitHub initialization writes a workflow accepted by actionlint',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'README.md': '# Workflow test\n' });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['actionlint']) };
            await install(sandbox.path, [...INIT, '--ci', 'github', '--no-hooks'], environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            expect(await Bun.file(join(sandbox.path, '.github/workflows/gspot.yml')).exists()).toBe(true);
            const result = Bun.spawnSync(['actionlint', '-no-color', '.github/workflows/gspot.yml'], {
                cwd: sandbox.path,
                env: { ...environmentVariables(), ...environment },
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(result.exitCode, result.stderr.toString() + result.stdout.toString()).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'each remaining check fires on its planted defect, and the two that others report say so',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script, 'settings/clean.toml': 'a = 1\n' });
            commitAll(sandbox.path);
            const environment = {
                PATH: toolsPath(['taplo', 'yamllint', 'actionlint', 'zizmor', 'dotenv-linter', 'typos', 'ec']),
            };
            await install(sandbox.path, [...INIT, '--no-hooks'], environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toMatch(
                    new RegExp(String.raw`^root\s+${planted.check}\s+fail\s`, 'u'),
                );
                const report = JSON.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).text()) as RunReport;
                const result = report.checks.find((entry) => entry.check === planted.check);
                expect(result?.status, outcome.stdout).toBe('fail');
                const finding = result?.findings.find(
                    (entry) => entry.file === planted.expected.file && entry.rule === planted.expected.rule,
                );
                expect(finding).toMatchObject({ check: planted.check, ...planted.expected });
            }
            const jsonCheck = await run(sandbox.path, ['check', '--only', 'configs/json'], environment);
            expect(jsonCheck.stdout).toContain('its findings come from');
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const record = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(record.checks.map((check) => check.check)).not.toContain('configs/schema');
            expect(record.checks.map((check) => check.check)).toContain('configs/toml');
        },
        PLANTED_TIMEOUT_MS * 2,
    );

    test.skipIf(process.platform !== 'darwin')(
        'configs/plist reports a property list that does not parse',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script, 'settings/clean.toml': 'a = 1\n' });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['taplo', 'typos', 'ec']) };
            await install(sandbox.path, [...INIT, '--no-hooks'], environment);
            const outcome = await runPlanted(
                sandbox.path,
                {
                    check: 'configs/plist',
                    files: { 'app/Info.plist': '<plist><dict><key>A</key></plist>\n' },
                },
                environment,
            );
            expect(outcome.code, outcome.stdout).toBe(1);
            expect(outcome.stdout).toContain('Info.plist');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'broken TOML, a duplicated YAML key and a missing environment key are reported',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/a.sh': script,
                'settings.toml': 'a = 1\n[x\n',
                'config.yaml': 'key: 1\nkey: 2\n',
                '.env.example': 'PORT=3000\n',
            });
            git(sandbox.path, ['init', '-q']);
            git(sandbox.path, ['add', '-A']);
            git(sandbox.path, ['commit', '-qm', 'init']);
            const initialized = await run(sandbox.path, INIT);
            expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
            expect(initialized.stdout).toContain('write');
            await installPrivateTools(sandbox.path);
            const selected = await run(sandbox.path, ['set', 'level', 'all']);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const environment = { PATH: toolsPath(['taplo', 'yamllint']) };
            const toml = await run(sandbox.path, ['check', '--only', 'configs/toml'], environment);
            expect(toml.code).toBe(1);
            expect(toml.stdout).toContain('settings.toml:2');
            const yaml = await run(sandbox.path, ['check', '--only', 'configs/yaml'], environment);
            expect(yaml.code).toBe(1);
            expect(yaml.stdout).toContain('key-duplicates');
            await Bun.write(
                join(sandbox.path, 'src', 'server.js'),
                'const host = process.env.HOST;\nconsole.log(host, process.env.PORT);\n',
            );
            git(sandbox.path, ['add', '-A']);
            const keys = await run(sandbox.path, ['check', '--only', 'configs/env-example', '--stage', 'push']);
            expect(keys.code).toBe(1);
            expect(keys.stdout).toContain('HOST');
            expect(keys.stdout).not.toContain('PORT is read');
        },
        PLANTED_TIMEOUT_MS,
    );
});

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
        await install(sandbox.path, [...INIT, '--no-hooks'], environment);
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const mapping = JSON.stringify({ pattern: 'settings/café.json', schema: 'schema.json' });
        const setting = await run(sandbox.path, ['set', 'tools.v8r.schemas', mapping], environment);
        expect(setting.code, setting.stdout + setting.stderr).toBe(0);
        const applied = await run(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        // A conflicting authored config must not replace the generated configuration.
        await Bun.write(join(sandbox.path, '.v8rrc.yml'), 'invalid: [\n');
        const path = join(sandbox.path, 'settings/café.json');
        await Bun.write(path, JSON.stringify({ count: 'invalid' }));
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const command = ['check', '--only', 'configs/schema', '--staged', '--stage', 'push', '--no-cache'];
        const invalid = await run(sandbox.path, command, environment);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect(invalid.stdout).toContain('settings/café.json');
        expect(invalid.stdout).toContain('must be integer');
        expect(invalid.stdout).not.toContain('broke:');
        await Bun.write(path, JSON.stringify({ count: 1 }));
        expect(git(sandbox.path, ['add', 'settings/café.json']).code).toBe(0);
        const valid = await run(sandbox.path, [...command, '--json'], environment);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        expect((JSON.parse(valid.stdout) as RunReport).checks).toMatchObject([
            { check: 'configs/schema', status: 'ok', findings: [] },
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
        await install(sandbox.path, [...INIT, '--no-hooks'], environment);
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const fixed = await run(
            sandbox.path,
            ['check', '--only', 'configs/dotenv', '--fix', '--no-cache'],
            environment,
        );
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, '.env.example')).text()).toBe('LOWERCASE=value\n');
        const checked = await run(sandbox.path, ['check', '--only', 'configs/dotenv', '--no-cache'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    },
    PLANTED_TIMEOUT_MS,
);
