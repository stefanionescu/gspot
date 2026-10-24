import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const DOCKERIGNORE_ALLOWLISTS = [
    { text: '*\n', missing: [] },
    { text: '**\n', missing: [] },
    { text: '**/*\n', missing: [] },
    { text: '*\n!src\n', missing: ['**/.env', '**/.env.*', '**/.dev.vars', '**/.dev.vars.*'] },
    { text: '*\n!src\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n', missing: [] },
    { text: '!src\n*\n', missing: [] },
    { text: '*\n!.env\n', missing: ['.env', '**/.env', '**/.env.*', '**/.dev.vars', '**/.dev.vars.*'] },
] as const;

export const DOCKERIGNORE_CASES = [
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
                file: 'Dockerfile',
                rule: 'missing-file',
                message:
                    'Add an ignore file at Dockerfile.dockerignore or .dockerignore that lists .git, .env, **/.env, **/.env.*, **/.dev.vars, **/.dev.vars.*.',
            },
            {
                file: 'app/Dockerfile',
                rule: 'missing-file',
                message:
                    'Add an ignore file at app/Dockerfile.dockerignore or app/.dockerignore that lists .git, .env, **/.env, **/.env.*, **/.dev.vars, **/.dev.vars.*, **/.venv/**, **/venv/**.',
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
    {
        name: 'the entries of Docker alone',
        files: {
            'gspot.toml': buildSandboxSettings(['docker'], { rules: true }),
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        },
        findings: [],
    },
    {
        name: 'the entries of JavaScript',
        files: {
            'gspot.toml': buildSandboxSettings(['docker', 'javascript'], { rules: true }),
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        },
        findings: [
            {
                file: '.dockerignore',
                rule: 'missing-entry',
                message: 'Add these entries to .dockerignore: **/node_modules/**, **/bower_components/**.',
            },
        ],
    },
    {
        name: 'the entries of Python',
        files: {
            'gspot.toml': buildSandboxSettings(['docker', 'python'], { rules: true }),
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n',
        },
        findings: [
            {
                file: '.dockerignore',
                rule: 'missing-entry',
                message: 'Add these entries to .dockerignore: **/.venv/**, **/venv/**.',
            },
        ],
    },
    {
        name: 'wildcard entries',
        files: {
            'gspot.toml': buildSandboxSettings(['docker', 'python', 'javascript'], { rules: true }),
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': `**/.git
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
        },
        findings: [],
    },
] as const;
