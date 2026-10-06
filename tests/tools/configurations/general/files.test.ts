// The configs configuration: TOML that does not parse, YAML with a duplicated key, and an environment key read after init that no template names.
import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { git, commitAll } from '#tests/harness/git.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { install, buildToolsPath } from '#tests/harness/install.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY, CONFIGS_INIT } from '#tests/config/tools/configurations/general/files.ts';

describe('the configs configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(REPOSITORY, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, REPOSITORY);
                expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                expect(outcome.report.checks[0]?.findings).toContainEqual(
                    containing({ check: entry.check, ...entry.expected }),
                );
                expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
                expect(correction.report.checks).toMatchObject([
                    { check: entry.check, status: 'passed', findings: [] },
                ]);
            },
            suiteTimeout(),
        );
    }

    test(
        'the commit stage keeps schema validation for push',
        async () => {
            const { root, environment } = testRepository;
            expect(git(root, ['add', '-A']).code).toBe(0);
            const checked = await spawnGspot(
                root,
                ['check', '--hook', 'pre-commit', '--only', 'files/taplo', 'files/v8r', '--json'],
                environment,
            );
            expect(checked.code, checked.stdout + checked.stderr).toBe(0);
            const ids = (JSON.parse(checked.stdout) as RunReport).checks.map((check) => check.check);
            expect(ids).not.toContain('files/v8r');
            expect(ids).toContain('files/taplo');
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});

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
])(
    'the configs configuration: $check rejects its invalid input and accepts the corrected file',
    async (scenario) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'scripts/a.sh': CLEAN_BASH_SCRIPT,
            'settings.toml': 'a = 1\n',
            'config.yaml': '---\nkey: 1\n',
            '.env.example': 'PORT=3000\n',
        });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['taplo', 'yamllint']) };
        await install(sandbox.path, CONFIGS_INIT, environment, { level: 'all' });
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
    NATIVE_TEST_TIMEOUT_MS,
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
        const environment = { PATH: buildToolsPath(['v8r']) };
        await install(sandbox.path, [...CONFIGS_INIT, '--no-hooks'], environment, { level: 'all' });
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
        const command = ['check', '--only', 'files/v8r', '--staged', '--json'];
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
    NATIVE_TEST_TIMEOUT_MS,
);
