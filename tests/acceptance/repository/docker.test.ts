// Planted repository for the docker preset: a careless Dockerfile, a missing ignore file, and a container that runs as root.
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
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

const CASES: PlantedCase[] = [
    {
        check: 'docker/compose-config',
        files: { 'api/compose.yml': 'services:\n    api:\n        image: example/image\n        bogus: true\n' },
        expected: 'bogus',
    },
    { check: 'docker/hadolint', files: { 'api/Dockerfile': CARELESS }, expected: 'DL3007' },
    {
        check: 'docker/dockerignore',
        files: { 'worker/Dockerfile': CLEAN },
        expected: 'No worker/.dockerignore sits beside this Dockerfile',
    },
    {
        check: 'docker/dockerignore',
        files: { 'api/.dockerignore': '.git\n' },
        expected: 'lets through: node_modules, .env',
    },
    { check: 'docker/trivy-config', files: { 'api/Dockerfile': CARELESS }, expected: 'DS-0002' },
];

describe('the docker preset', () => {
    test(
        'every docker check fires on its planted defect',
        async () => {
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
            const checkIds = new Set(CASES.map((planted) => planted.check));
            for (const id of checkIds) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
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
