export const COMPOSE_PAIRING_CASES = [
    { base: 'compose.yaml', override: 'compose.override.yaml' },
    { base: 'docker-compose.yml', override: 'docker-compose.production.yml' },
] as const;

const REQUIRED_DOCKERIGNORE = '.git\n.env\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n';

export const DOCKERIGNORE_ALLOWLISTS = [
    { text: `${REQUIRED_DOCKERIGNORE}!.env\n`, missing: ['.env'] },
    { text: `${REQUIRED_DOCKERIGNORE}!**/.env\n`, missing: ['.env', '**/.env'] },
    { text: '*\n', missing: [] },
    { text: '*\n!src\n', missing: ['**/.env', '**/.env.*', '**/.dev.vars', '**/.dev.vars.*'] },
    { text: '*\n!src\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n', missing: [] },
    { text: '!src\n*\n', missing: [] },
    { text: '*\n!.env\n', missing: ['.env', '**/.env', '**/.env.*', '**/.dev.vars', '**/.dev.vars.*'] },
] as const;

export const DOCKERIGNORE_CASES = [
    {
        name: 'each scope lists the folders of its own configurations',
        configurations: ['docker'],
        options: { level: 'all', rules: true, scopes: [{ path: 'app', configurations: ['python'] }] },
        files: {
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
        configurations: ['docker'],
        options: { level: 'all' },
        files: {
            Dockerfile: 'FROM scratch\n',
            'Dockerfile.dockerignore': REQUIRED_DOCKERIGNORE,
        },
        findings: [],
    },
    {
        name: 'a suffixed Dockerfile-specific ignore',
        configurations: ['docker'],
        options: { level: 'all' },
        files: {
            'Dockerfile.test': 'FROM scratch\n',
            'Dockerfile.test.dockerignore': REQUIRED_DOCKERIGNORE,
        },
        findings: [],
    },
    {
        name: 'a Compose build context with a nested Dockerfile',
        configurations: ['docker'],
        options: { level: 'all' },
        files: {
            'compose.yaml': 'services: {app: {build: {context: project, dockerfile: docker/Dockerfile}}}\n',
            'project/docker/Dockerfile': 'FROM scratch\n',
            'project/.dockerignore': REQUIRED_DOCKERIGNORE,
        },
        findings: [],
    },
    {
        name: 'a partial override retaining the same service context',
        configurations: ['docker'],
        options: { level: 'all' },
        files: {
            'compose.yaml': 'services: {app: {build: {context: project}}}\n',
            'compose.override.yaml': 'services: {app: {build: {dockerfile: docker/Dockerfile}}}\n',
            'project/docker/Dockerfile': 'FROM scratch\n',
            'project/.dockerignore': REQUIRED_DOCKERIGNORE,
        },
        findings: [],
    },
    {
        name: 'an unrelated ignored service beside a missing service ignore',
        configurations: ['docker'],
        options: { level: 'all' },
        files: {
            'compose.yaml': 'services: {affected: {build: {context: affected}}, other: {build: {context: other}}}\n',
            'compose.override.yaml': 'services: {affected: {build: {dockerfile: Dockerfile}}}\n',
            'affected/Dockerfile': 'FROM scratch\n',
            'other/Dockerfile': 'FROM scratch\n',
            'other/.dockerignore': REQUIRED_DOCKERIGNORE,
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
        configurations: ['docker'],
        options: { level: 'all' },
        files: {
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': REQUIRED_DOCKERIGNORE,
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
        name: 'wildcard entries',
        configurations: ['docker', 'python', 'javascript'],
        options: { rules: true },
        files: {
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

export const NGINX_COMPOSE = 'services: {app: {image: nginx:1.27.2}}\n';

export const COMPOSE_SOURCES = [
    {
        name: 'a local build beside a registry image',
        source: 'services: {app: {build: ., image: example/web:dev}, proxy: {image: nginx:1.27.2}}',
    },
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

export const TRIVY_REGISTRY_FAILURE = {
    code: 1,
    stdout: '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"}]}]}',
    stderr: 'FATAL registry authentication failed',
    message: 'Trivy could not scan nginx:1.27.2: FATAL registry authentication failed',
} as const;

export const INVALID_COMPOSE_SOURCES = [
    {
        name: 'malformed YAML',
        source: 'services: [',
        message:
            'compose.yaml is not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 12. Fix the file.',
    },
    {
        name: 'a non-string image',
        source: 'services: {app: {image: 12}}',
        message: 'compose.yaml: services.app.image: Invalid input: expected string, received number. Fix the field.',
    },
] as const;

export const TRIVY_IMAGE_FINDINGS = [
    {
        check: 'docker/trivy-image',
        help: 'Move to a newer tag of the image. Accept one advisory with `gspot ignore docker/trivy-image --rule <rule> --reason "<why>"`.',
        file: 'compose.yaml',
        line: 1,
        rule: 'CVE-example',
        message: 'nginx:1.27.2: CVE-example (example)',
        fixable: false,
    },
] as const;
