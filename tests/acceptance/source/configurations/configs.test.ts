import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
// The configs configuration: TOML that does not parse, YAML with a duplicated key, and an environment key read after init that no template names.
import { reportSchema } from '#cli/output/schema.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { runPlanted, script } from '#tests/support/cli/planted.ts';
import { PLANTED_TIMEOUT_MS, run, runProcess } from '#tests/support/cli/command.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';

const INIT = ['init', '--yes', '--configurations', 'configs', '--no-runner', '--no-ci', '--no-rules', '--no-install'];

const WORKFLOW_HEAD =
    'name: planted\non: [push]\npermissions:\n    contents: read\njobs:\n    build:\n        runs-on: ubuntu-24.04\n        steps:\n';

const CASES: (FindingCase & { corrected: Record<string, string> })[] = [
    {
        check: 'configs/toml-format',
        corrected: { 'settings/layout.toml': 'a = 1\nb = 2\n' },
        files: { 'settings/layout.toml': 'a    =     1\nb=2\n' },
        expected: {
            file: 'settings/layout.toml',
            message: 'The file is not formatted with the configured TOML settings.',
        },
    },
    {
        check: 'configs/actions',
        corrected: { '.github/workflows/broken.yml': `${WORKFLOW_HEAD}            - run: echo corrected\n` },
        files: { '.github/workflows/broken.yml': `${WORKFLOW_HEAD}            - run: echo "\${{ nothing.here }}"\n` },
        expected: { file: '.github/workflows/broken.yml', rule: 'expression', line: 9, column: 30 },
    },
    {
        check: 'configs/actions-security',
        corrected: { '.github/workflows/unpinned.yml': `${WORKFLOW_HEAD}            - run: echo corrected\n` },
        files: {
            '.github/workflows/unpinned.yml': `${WORKFLOW_HEAD}            - uses: actions/checkout@v4\n            - run: echo "\${{ github.event.pull_request.title }}"\n`,
        },
        expected: { file: '.github/workflows/unpinned.yml', rule: 'template-injection', line: 10 },
    },
    {
        check: 'configs/dotenv',
        corrected: { '.env.example': 'PORT=3000\n' },
        files: { '.env.example': 'PORT=3000\nport=3000\nPORT=4000\n' },
        expected: { file: '.env.example', rule: 'LowercaseKey', line: 2 },
    },
    {
        check: 'configs/xml',
        corrected: { 'settings/feed.xml': '<feed><entry /></feed>\n' },
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
            const result = await runProcess(['actionlint', '-no-color', '.github/workflows/gspot.yml'], {
                cwd: sandbox.path,
                env: environment,
            });
            expect(result.code, result.stderr + result.stdout).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );

    test.each(CASES)(
        '$check reports the defect in $expected.file and accepts corrected configuration',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script, 'settings/clean.toml': 'a = 1\n' });
            commitAll(sandbox.path);
            const environment = {
                PATH: toolsPath(['taplo', 'yamllint', 'actionlint', 'zizmor', 'dotenv-linter', 'typos', 'ec']),
            };
            await install(sandbox.path, [...INIT, '--no-hooks'], environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const report = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(report.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(report.checks[0]?.findings).toContainEqual(
                expect.objectContaining({ check: planted.check, ...planted.expected }),
            );
            await createFileTree(sandbox.path, planted.corrected);
            const corrected = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: planted.check, status: 'ok', findings: [] },
            ]);
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
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: 'configs/plist', status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining({ file: 'app/Info.plist' }));
            await Bun.write(
                join(sandbox.path, 'app/Info.plist'),
                '<?xml version="1.0"?><plist version="1.0"><dict><key>A</key><string>value</string></dict></plist>\n',
            );
            const corrected = await run(
                sandbox.path,
                ['check', '--only', 'configs/plist', '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: 'configs/plist', status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS,
    );

    test.each([
        {
            check: 'configs/toml',
            path: 'settings.toml',
            broken: 'a = 1\n[x\n',
            corrected: 'a = 1\n',
            expected: { file: 'settings.toml', line: 2 },
        },
        {
            check: 'configs/yaml',
            path: 'config.yaml',
            broken: 'key: 1\nkey: 2\n',
            corrected: '---\nkey: 1\n',
            expected: { file: 'config.yaml', line: 2, rule: 'key-duplicates' },
        },
        {
            check: 'configs/env-example',
            path: '.env.example',
            broken: 'PORT=3000\n',
            corrected: 'PORT=3000\nHOST=localhost\n',
            expected: { file: 'src/server.js', line: 1, rule: 'missing-key' },
        },
    ])(
        '$check rejects its invalid input and accepts the corrected file',
        async (scenario) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/a.sh': script,
                'settings.toml': 'a = 1\n',
                '.env.example': 'PORT=3000\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['taplo', 'yamllint']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            await createFileTree(sandbox.path, {
                [scenario.path]: scenario.broken,
                'src/server.js': 'const host = process.env.HOST;\nconsole.log(host, process.env.PORT);\n',
            });
            const command = ['check', '--only', scenario.check, '--no-cache', '--json'];
            const failed = await run(sandbox.path, command, environment);
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            const report = reportSchema.parse(JSON.parse(failed.stdout));
            expect(report.checks).toMatchObject([{ check: scenario.check, status: 'fail' }]);
            expect(report.checks[0]!.findings).toContainEqual(expect.objectContaining(scenario.expected));
            await Bun.write(join(sandbox.path, scenario.path), scenario.corrected);
            const corrected = await run(sandbox.path, command, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: scenario.check, status: 'ok', findings: [] },
            ]);
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
        const command = ['check', '--only', 'configs/schema', '--staged', '--stage', 'push', '--no-cache', '--json'];
        const invalid = await run(sandbox.path, command, environment);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(invalid.stdout)).checks).toMatchObject([
            {
                check: 'configs/schema',
                status: 'fail',
                findings: [
                    expect.objectContaining({
                        file: 'settings/café.json',
                        message: expect.stringContaining('must be integer'),
                    }),
                ],
            },
        ]);
        await Bun.write(path, JSON.stringify({ count: 1 }));
        expect(git(sandbox.path, ['add', 'settings/café.json']).code).toBe(0);
        const valid = await run(sandbox.path, command, environment);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(valid.stdout)).checks).toMatchObject([
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
