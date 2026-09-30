// Planted repository for the docker configuration: a careless Dockerfile, a missing ignore file, and a container that runs as root.
import { test, expect } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { plantedCases } from '#tests/support/cli/planted.ts';
import { textContaining } from '#tests/support/expectations.ts';
import { IGNORES, CARELESS, DOCKER_CLEAN } from '#tests/inputs/acceptance/source/kits/kits.ts';

plantedCases(
    'the docker configuration',
    {
        kits: ['docker'],
        modules: false,
        without: [],
        tools: ['hadolint', 'trivy', 'taplo', 'yamllint'],
        files: {
            'api/Dockerfile': DOCKER_CLEAN,
            'api/.dockerignore': IGNORES,
            'api/compose.yml': 'services:\n    api:\n        build: .\n',
            'api/package.json': '{\n    "name": "planted",\n    "private": true\n}\n',
        },
    },
    [
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
            corrected: { files: { 'worker/Dockerfile': DOCKER_CLEAN, 'worker/.dockerignore': IGNORES } },
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
    ],
    (planted) => {
        test(
            'the push stage runs the compose check and leaves the image scan to its own stage',
            async () => {
                const { root, environment } = planted();
                const checked = await run(root, ['check', '--stage', 'push', '--json'], environment);
                const ids = reportSchema.parse(JSON.parse(checked.stdout)).checks.map((check) => check.check);
                expect(ids).toContain('docker/compose-config');
                expect(ids).not.toContain('docker/trivy-image');
            },
            PLANTED_TIMEOUT_MS * 2,
        );
    },
);
