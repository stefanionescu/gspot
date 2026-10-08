import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const DOCKER_CLEAN =
    'FROM node:22.11.0-bookworm-slim\nWORKDIR /app\nCOPY package.json ./\nUSER node\nHEALTHCHECK CMD ["node", "--version"]\nCMD ["node", "index.js"]\n';

export const CARELESS = 'FROM node:latest\nCOPY . .\nCMD ["node", "index.js"]\n';

export const IGNORES = '.git\nnode_modules\n.env*\n';

export const REPOSITORY: InstalledScenario = {
    configurations: ['docker'],

    tools: ['hadolint', 'trivy'],
    files: {
        'api/Dockerfile': DOCKER_CLEAN,
        'api/.dockerignore': IGNORES,
        'api/compose.yml': 'services:\n    api:\n        build: .\n',
        'api/package.json': '{\n    "name": "example",\n    "private": true\n}\n',
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'docker/compose',
        docker: true,
        files: { 'api/compose.yml': 'services:\n    api:\n        image: example/image\n        bogus: true\n' },
        expected: { file: 'api/compose.yml', message: 'bogus' },
    },
    {
        check: 'docker/hadolint',
        files: { 'api/Dockerfile': CARELESS },
        expected: { file: 'api/Dockerfile', rule: 'DL3007', line: 1 },
    },
    {
        check: 'docker/trivy-config',
        files: { 'api/Dockerfile': CARELESS },
        expected: { file: 'api/Dockerfile', rule: 'DS-0002' },
    },
];
