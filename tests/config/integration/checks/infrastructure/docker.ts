import type { ScopeFindingFiles } from '#tests/types/reports.ts';

export const DOCKER_SANDBOX = {
    install: false,
    configurations: ['docker'],
    files: {
        'api/Dockerfile': `FROM node:22.11.0-bookworm-slim
WORKDIR /app
COPY package.json ./
USER node
HEALTHCHECK CMD ["node", "--version"]
CMD ["node", "index.js"]
`,
        'api/.dockerignore': `.git
node_modules
.env*
`,
        'api/compose.yml': `services:
    api:
        build: .
`,
        'api/package.json': `{
    "name": "example",
    "private": true
}
`,
    },
} as const;

export const DOCKER_CASES = [
    {
        check: 'docker/compose',
        files: {
            'api/compose.yml': `services:
    api:
        image: example/image
        bogus: true
`,
        },
        expected: { file: 'api/compose.yml', message: 'bogus' },
    },
];

export const ROOT_USER_DOCKERFILE = `FROM node:22.11.0-bookworm-slim
WORKDIR /app
USER root
HEALTHCHECK CMD ["node", "--version"]
CMD ["node", "index.js"]
`;

export const DEBIAN_DOCKERFILE = `FROM debian:12
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
USER 1000
`;

export const ALPINE_DOCKERFILE = `FROM alpine:3.20.3
RUN apk add --no-cache curl
USER 1000
`;

export const TRIVY_SCOPE_TABLES = `[[scope]]
path = "app"

[[scope]]
path = "app/child"

[[scope]]
path = "sibling"

[[ignore]]
check = "docker/trivy-config"
rule = "DS-0002"
paths = ["app/**"]
reason = "This test exercises scoped advisory exceptions."
`;

export const TRIVY_SCOPE_RESULTS: ScopeFindingFiles[] = [
    { scope: '', status: 'failed', files: ['Dockerfile'] },
    { scope: 'app', status: 'passed', files: [] },
    { scope: 'app/child', status: 'passed', files: [] },
    { scope: 'sibling', status: 'failed', files: ['sibling/Dockerfile'] },
];
