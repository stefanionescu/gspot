// Trivy uses this configured exit code when an image report contains findings.
export const TRIVY_FINDINGS_EXIT = 10;

export const VALID_REPORT =
    '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"}]}]}';

export const MIXED_REPORT =
    '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"},{"VulnerabilityID":"CVE-neighbor","PkgName":"neighbor"}],"Secrets":[{"RuleID":"private-key","Title":"Private key","Secret":"sensitive-native-value"}]}]}';

export const COMPOSE_SOURCES = [
    {
        name: 'an inherited service mapping',
        source: `x-base: &base
  image: nginx:1.27.2
services:
  app:
    <<: *base
`,
    },
    {
        name: 'duplicate services with interpolation and unrelated images',
        source: `x-example: {image: unrelated:1}
services: {app: {image: nginx:1.27.2}, copy: {image: nginx:1.27.2}, env: {image: "\${IMAGE}"}, local: {build: .}}
`,
    },
] as const;

export const REPORT_FAILURES = {
    code: 1,
    stdout: VALID_REPORT,
    stderr: 'FATAL registry authentication failed',
    diagnostic: 'Trivy could not scan nginx:1.27.2: FATAL registry authentication failed',
} as const;

export const INVALID_COMPOSE = [
    { name: 'malformed YAML', source: 'services: [' },
    { name: 'a non-string image', source: 'services: {app: {image: 12}}' },
    { name: 'an empty service value', source: 'services: {app: null}' },
] as const;

export const DOCKERIGNORE_CASES = [
    { name: 'Docker alone', settings: 'configurations = ["docker"]\n', text: '.git\n.env\n', missing: '', scope: '' },
    {
        name: 'JavaScript',
        settings: 'configurations = ["docker", "javascript"]\n',
        text: '.git\n.env\n',
        missing: 'node_modules, bower_components',
        scope: '',
    },
    {
        name: 'Python',
        settings: 'configurations = ["docker", "python"]\n',
        text: '.git\n.env\n',
        missing: '.venv, venv',
        scope: '',
    },
    {
        name: 'native wildcard entries',
        settings: 'configurations = ["docker", "python", "javascript"]\n',
        text: `**/.git
**/.env*
**/node_modules
**/bower_components
**/.venv
**/venv
`,
        missing: '',
        scope: '',
    },
    {
        name: 'a sibling language scope',
        settings: `configurations = ["docker"]
[[scope]]
path = "api"

configurations = ["docker", "python"]
[[scope]]
path = "web"

configurations = ["javascript"]
`,
        text: `.git
.env
.venv
venv
`,
        missing: '',
        scope: 'api',
    },
] as const;

export const DOCKER_CONTEXT_CASES = [
    {
        name: 'a Dockerfile-specific ignore',
        files: { Dockerfile: 'FROM scratch\n', 'Dockerfile.dockerignore': '.git\n.env\n' },
        findings: [],
    },
    {
        name: 'a suffixed Dockerfile-specific ignore',
        files: { 'Dockerfile.test': 'FROM scratch\n', 'Dockerfile.test.dockerignore': '.git\n.env\n' },
        findings: [],
    },
    {
        name: 'a Compose build context with a nested Dockerfile',
        files: {
            'compose.yaml': 'services: {app: {build: {context: project, dockerfile: docker/Dockerfile}}}\n',
            'project/docker/Dockerfile': 'FROM scratch\n',
            'project/.dockerignore': '.git\n.env\n',
        },
        findings: [],
    },
    {
        name: 'a partial override retaining the same service context',
        files: {
            'compose.yaml': 'services: {app: {build: {context: project}}}\n',
            'compose.override.yaml': 'services: {app: {build: {dockerfile: docker/Dockerfile}}}\n',
            'project/docker/Dockerfile': 'FROM scratch\n',
            'project/.dockerignore': '.git\n.env\n',
        },
        findings: [],
    },
    {
        name: 'an unrelated ignored service beside a missing service ignore',
        files: {
            'compose.yaml': 'services: {affected: {build: {context: affected}}, other: {build: {context: other}}}\n',
            'compose.override.yaml': 'services: {affected: {build: {dockerfile: Dockerfile}}}\n',
            'affected/Dockerfile': 'FROM scratch\n',
            'other/Dockerfile': 'FROM scratch\n',
            'other/.dockerignore': '.git\n.env\n',
        },
        findings: [
            {
                file: 'affected/Dockerfile',
                rule: 'missing-file',
                message:
                    'Add an ignore file at affected/Dockerfile.dockerignore or affected/.dockerignore that lists .git, .env.',
            },
        ],
    },
    {
        name: 'a specific ignore taking precedence over the general ignore',
        files: { Dockerfile: 'FROM scratch\n', '.dockerignore': '.git\n.env\n', 'Dockerfile.dockerignore': '.git\n' },
        findings: [
            {
                file: 'Dockerfile.dockerignore',
                rule: 'missing-entry',
                message: 'Add these entries to Dockerfile.dockerignore: .env.',
            },
        ],
    },
    {
        name: 'a missing ignore with no alternative',
        files: { Dockerfile: 'FROM scratch\n' },
        findings: [
            {
                file: 'Dockerfile',
                rule: 'missing-file',
                message: 'Add an ignore file at Dockerfile.dockerignore or .dockerignore that lists .git, .env.',
            },
        ],
    },
] as const;

export const DOCKER_VERSION = '29.0.0';

export const COMPOSE_PAIRING_CASES = [
    { base: 'compose.yaml', override: 'compose.override.yaml' },
    { base: 'compose.yml', override: 'compose.override.yml' },
    { base: 'docker-compose.yaml', override: 'docker-compose.override.yaml' },
    { base: 'docker-compose.yml', override: 'docker-compose.production.yml' },
] as const;

export const DOCKER_SANDBOX = {
    configurations: ['docker'],

    tools: ['hadolint', 'trivy'],
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
        expected: { file: 'api/compose.yml', message: "services.api additional properties 'bogus' not allowed" },
    },
    {
        check: 'docker/hadolint',
        files: {
            'api/Dockerfile': `FROM node:latest
COPY . .
CMD ["node", "index.js"]
`,
        },
        expected: { file: 'api/Dockerfile', rule: 'DL3007', line: 1 },
    },
] as const;

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

export const TRIVY_SCOPE_SETTINGS = `[[scope]]
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
