const REQUIRED_DOCKERIGNORE = '.git\n.env\n**/coverage/**\n**/.env\n**/.env.*\n**/.dev.vars\n**/.dev.vars.*\n';

export const DOCKERIGNORE_CASES = [
    {
        name: 'each scope lists the folders of its own configurations',
        configurations: ['docker'],
        options: { level: 'all', rules: true, scopes: [{ path: 'app', configurations: ['python'] }] },
        files: {
            Dockerfile: 'FROM scratch\n',
            '.dockerignore': REQUIRED_DOCKERIGNORE,
            'app/Dockerfile': 'FROM scratch\n',
            'app/.dockerignore': REQUIRED_DOCKERIGNORE,
        },
        findings: [{ file: 'app/.dockerignore', rule: 'missing-entry', entry: '**/__pycache__/**' }],
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
        findings: [{ file: 'affected/Dockerfile', rule: 'missing-file', entry: '**/coverage/**' }],
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
        findings: [{ file: 'Dockerfile.dockerignore', rule: 'missing-entry', entry: '**/coverage/**' }],
    },
] as const;

export const NGINX_COMPOSE = 'services: {app: {image: nginx:1.27.2}}\n';

export const COMPOSE_SOURCES = [
    {
        name: 'a local build beside a registry image',
        source: 'services: {app: {build: ., image: example/web:dev}, proxy: {image: nginx:1.27.2}}',
    },
    {
        name: 'duplicate services with interpolation and unrelated images',
        source: `x-example: {image: unrelated:1}
services: {app: {image: nginx:1.27.2}, copy: {image: nginx:1.27.2}, env: {image: "\${IMAGE}"}, local: {build: .}}
`,
    },
] as const;

export const TRIVY_REPORT =
    '{"SchemaVersion":2,"ArtifactName":"nginx:1.27.2","Results":[{"Target":"nginx","Vulnerabilities":[{"VulnerabilityID":"CVE-example","PkgName":"example"}]}]}';

export const TRIVY_REGISTRY_FAILURE = {
    code: 1,
    stdout: TRIVY_REPORT,
    stderr: 'FATAL registry authentication failed',
} as const;

export const TRIVY_IMAGE_FINDINGS = [
    {
        file: 'compose.yaml',
        line: 1,
        rule: 'CVE-example',
        message: 'nginx:1.27.2: CVE-example (example)',
    },
] as const;
