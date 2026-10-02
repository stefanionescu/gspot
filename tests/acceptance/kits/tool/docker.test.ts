// Planted repository for the docker configuration: a careless Dockerfile, a missing ignore file, and a container that runs as root.
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { textContaining } from '#tests/harness/expectations.ts';
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
            docker: true,
            files: { 'api/compose.yml': 'services:\n    api:\n        image: example/image\n        bogus: true\n' },
            expected: { file: 'api/compose.yml', message: textContaining('bogus') },
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
    ],
);
