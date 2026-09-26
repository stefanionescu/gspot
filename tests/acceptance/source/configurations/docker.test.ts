import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the docker configuration: a careless Dockerfile, a missing ignore file, and a container that runs as root.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'docker',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const CLEAN =
    'FROM node:22.11.0-bookworm-slim\nWORKDIR /app\nCOPY package.json ./\nUSER node\nHEALTHCHECK CMD ["node", "--version"]\nCMD ["node", "index.js"]\n';
const CARELESS = 'FROM node:latest\nCOPY . .\nCMD ["node", "index.js"]\n';
const IGNORES = '.git\nnode_modules\n.env*\n';

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
        files: { 'worker/Dockerfile': CLEAN },
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
                'api/Dockerfile': CLEAN,
                'api/.dockerignore': IGNORES,
                'api/compose.yml': 'services:\n    api:\n        build: .\n        env_file: .env\n',
                'api/package.json': '{\n    "name": "planted",\n    "private": true\n}\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['hadolint', 'trivy', 'typos', 'ec', 'taplo', 'yamllint']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
            if (planted.expected.file === 'worker/Dockerfile')
                await createFileTree(sandbox.path, { 'worker/Dockerfile': CLEAN, 'worker/.dockerignore': IGNORES });
            const corrected = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: planted.check, status: 'ok', findings: [] },
            ]);
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
