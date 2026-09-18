// Planted repository for the docker preset: a careless Dockerfile, a missing ignore file, and a container that runs as root.
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { composeImages } from '#cli/integrity/docker/image-scan.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'docker',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const CLEAN =
    'FROM node:22.11.0-bookworm-slim\nWORKDIR /app\nCOPY package.json ./\nUSER node\nHEALTHCHECK CMD ["node", "--version"]\nCMD ["node", "index.js"]\n';
const CARELESS = 'FROM node:latest\nCOPY . .\nCMD ["node", "index.js"]\n';
const IGNORES = '.git\nnode_modules\n.env*\n';

const CASES: PlantedCase[] = [
    { id: 'docker/hadolint', files: { 'api/Dockerfile': CARELESS }, expected: 'DL3007' },
    {
        id: 'docker/dockerignore',
        files: { 'worker/Dockerfile': CLEAN },
        expected: 'No worker/.dockerignore sits beside this Dockerfile',
    },
    {
        id: 'docker/dockerignore',
        files: { 'api/.dockerignore': '.git\n' },
        expected: 'lets through: node_modules, .env',
    },
    { id: 'docker/trivy-config', files: { 'api/Dockerfile': CARELESS }, expected: 'DS-0002' },
];

describe('the docker preset', () => {
    test(
        'every docker check fires on its planted defect',
        async () => {
            await using fixture = await createFixture({
                'api/Dockerfile': CLEAN,
                'api/.dockerignore': IGNORES,
                'api/compose.yml': 'services:\n    api:\n        build: .\n',
                'api/package.json': '{\n    "name": "planted",\n    "private": true\n}\n',
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['hadolint', 'trivy', 'typos', 'ec', 'taplo', 'yamllint']) };
            await install(fixture.path, INIT, environment);
            const checkIds = new Set(CASES.map((planted) => planted.id));
            for (const id of checkIds) {
                const clean = run(fixture.path, ['check', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            const atPush = JSON.parse(run(fixture.path, ['check', '--at', 'push', '--json'], environment).stdout) as {
                checks: { id: string }[];
            };
            const ids = atPush.checks.map((check) => check.id);
            expect(ids).toContain('docker/compose-config');
            expect(ids).not.toContain('docker/trivy-image');
        },
        PLANTED_TIMEOUT_MS * 4,
    );

    test('the image scan reads the images a Compose file names, and skips one that comes from a variable', () => {
        const compose =
            'services:\n    proxy:\n        image: "nginx:1.27.2"\n    api:\n        image: ${API_IMAGE}\n    cache:\n        image: redis:7.4.1 # pinned\n';
        expect(composeImages(compose)).toEqual(['nginx:1.27.2', 'redis:7.4.1']);
    });
});
