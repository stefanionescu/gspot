import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
// Planted repository for the docker configuration: a careless Dockerfile, a missing ignore file, and a container that runs as root.
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';
import { DOCKER_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';
import { CARELESS, DOCKER_CLEAN, IGNORES } from '#tests/constants/acceptance/source/configurations/configurations.ts';

const CASES: FindingCase[] = [
    {
        check: 'docker/compose-config',
        files: { 'api/compose.yml': 'services:\n    api:\n        image: example/image\n        bogus: true\n' },
        expected: { file: 'api/compose.yml', message: textContaining('bogus') },
    },
    {
        check: 'docker/hadolint',
        files: { 'api/Dockerfile': CARELESS },
        expected: { file: 'api/Dockerfile', rule: 'DL3007', line: 1 },
    },
    {
        check: 'docker/dockerignore',
        files: { 'worker/Dockerfile': DOCKER_CLEAN },
        expected: { file: 'worker/Dockerfile', rule: 'missing', line: 1 },
    },
    {
        check: 'docker/dockerignore',
        files: { 'api/.dockerignore': '.git\n' },
        expected: { file: 'api/.dockerignore', rule: 'entries', line: 1 },
    },
    {
        check: 'docker/trivy-config',
        files: { 'api/Dockerfile': CARELESS },
        expected: { file: 'api/Dockerfile', rule: 'DS-0002' },
    },
];

describe('the docker configuration', () => {
    test.each(CASES)(
        '$check reports its defect in $expected.file and accepts corrected configuration',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'api/Dockerfile': DOCKER_CLEAN,
                'api/.dockerignore': IGNORES,
                'api/compose.yml': 'services:\n    api:\n        build: .\n        env_file: .env\n',
                'api/package.json': '{\n    "name": "planted",\n    "private": true\n}\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['hadolint', 'trivy', 'typos', 'ec', 'taplo', 'yamllint']) };
            await installAtLevel(sandbox.path, DOCKER_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
            if (planted.expected.file === 'worker/Dockerfile')
                await createFileTree(sandbox.path, {
                    'worker/Dockerfile': DOCKER_CLEAN,
                    'worker/.dockerignore': IGNORES,
                });
            await expectCorrected(sandbox.path, planted.check, environment);
            const checked = await run(sandbox.path, ['check', '--stage', 'push', '--json'], environment);
            const atPush = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            const ids = atPush.checks.map((check) => check.check);
            expect(ids).toContain('docker/compose-config');
            expect(ids).not.toContain('docker/trivy-image');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
