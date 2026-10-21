import { buildSandboxSettings } from '#tests/setup/settings.ts';

// Trivy uses this configured exit code when an image report contains findings.
export const TRIVY_CONFIG_PATH = '.gspot/configurations/infrastructure/docker/trivy.yml';

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
    message: 'Trivy could not scan nginx:1.27.2: FATAL registry authentication failed',
} as const;

export const INVALID_COMPOSE = [
    { name: 'malformed YAML', source: 'services: [', message: 'compose.yaml is not valid YAML:' },
    {
        name: 'a non-string image',
        source: 'services: {app: {image: 12}}',
        message: 'compose.yaml: services.app.image:',
    },
    { name: 'an empty service value', source: 'services: {app: null}', message: 'compose.yaml: services.app:' },
] as const;

export const DOCKERIGNORE_CASES = [
    {
        name: 'Docker alone',
        settings: buildSandboxSettings(['docker'], { rules: true }),
        text: '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        missing: '',
        scope: '',
    },
    {
        name: 'JavaScript',
        settings: buildSandboxSettings(['docker', 'javascript'], { rules: true }),
        text: '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        missing: '**/node_modules/**, **/bower_components/**',
        scope: '',
    },
    {
        name: 'Python',
        settings: buildSandboxSettings(['docker', 'python'], { rules: true }),
        text: '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        missing: '**/.venv/**, **/venv/**',
        scope: '',
    },
    {
        name: 'wildcard entries',
        settings: buildSandboxSettings(['docker', 'python', 'javascript'], { rules: true }),
        text: `**/.git
**/.env*
**/.env
**/.env.*
**/.dev.vars
**/.dev.vars.*
**/node_modules/**
**/bower_components/**
**/.venv/**
**/venv/**
`,
        missing: '',
        scope: '',
    },
    {
        name: 'a sibling language scope',
        settings: buildSandboxSettings(['docker'], {
            rules: true,
            scopes: [
                { path: 'api', configurations: ['docker', 'python'] },
                { path: 'web', configurations: ['javascript'] },
            ],
        }),
        text: `.git
.env
**/.env
**/.env.*
**/.dev.vars
**/.dev.vars.*
**/.venv/**
**/venv/**
`,
        missing: '',
        scope: 'api',
    },
] as const;

export const DOCKER_CONTEXT_CASES = [
    {
        name: 'each scope lists the folders of its own configurations',
        files: {
            'gspot.toml': buildSandboxSettings(['docker'], {
                level: 'all',
                rules: true,
                scopes: [{ path: 'app', configurations: ['python'] }],
            }),
            Dockerfile: 'FROM scratch\n',
            'app/Dockerfile': 'FROM scratch\n',
        },
        findings: [
            {
                file: 'app/Dockerfile',
                rule: 'missing-file',
                message:
                    'Add an ignore file at app/Dockerfile.dockerignore or app/.dockerignore that lists .git, .env, **/.env, **/.env.*, **/.dev.vars, **/.dev.vars.*, **/.venv/**, **/venv/**.',
            },
            {
                file: 'Dockerfile',
                rule: 'missing-file',
                message:
                    'Add an ignore file at Dockerfile.dockerignore or .dockerignore that lists .git, .env, **/.env, **/.env.*, **/.dev.vars, **/.dev.vars.*.',
            },
        ],
    },
    {
        name: 'a Dockerfile-specific ignore',
        files: {
            Dockerfile: 'FROM scratch\n',
            'Dockerfile.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        },
        findings: [],
    },
    {
        name: 'a suffixed Dockerfile-specific ignore',
        files: {
            'Dockerfile.test': 'FROM scratch\n',
            'Dockerfile.test.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        },
        findings: [],
    },
    {
        name: 'a Compose build context with a nested Dockerfile',
        files: {
            'compose.yaml': 'services: {app: {build: {context: project, dockerfile: docker/Dockerfile}}}\n',
            'project/docker/Dockerfile': 'FROM scratch\n',
            'project/.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        },
        findings: [],
    },
    {
        name: 'a partial override retaining the same service context',
        files: {
            'compose.yaml': 'services: {app: {build: {context: project}}}\n',
            'compose.override.yaml': 'services: {app: {build: {dockerfile: docker/Dockerfile}}}\n',
            'project/docker/Dockerfile': 'FROM scratch\n',
            'project/.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
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
            'other/.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        },
        findings: [
            {
                file: 'affected/Dockerfile',
                rule: 'missing-file',
                message:
                    'Add an ignore file at affected/Dockerfile.dockerignore or affected/.dockerignore that lists .git, .env, **/.env, **/.env.*, **/.dev.vars, **/.dev.vars.*.',
            },
        ],
    },
    {
        name: 'a specific ignore taking precedence over the general ignore',
        files: {
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
            'Dockerfile.dockerignore': '.git\n',
        },
        findings: [
            {
                file: 'Dockerfile.dockerignore',
                rule: 'missing-entry',
                message:
                    'Add these entries to Dockerfile.dockerignore: .env, **/.env, **/.env.*, **/.dev.vars, **/.dev.vars.*.',
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
                message:
                    'Add an ignore file at Dockerfile.dockerignore or .dockerignore that lists .git, .env, **/.env, **/.env.*, **/.dev.vars, **/.dev.vars.*.',
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

export const NGINX_COMPOSE = 'services: {app: {image: nginx:1.27.2}}\n';
