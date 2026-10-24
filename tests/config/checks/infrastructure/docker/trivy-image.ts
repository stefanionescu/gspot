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
    {
        name: 'an empty service value',
        source: 'services: {app: null}',
        message: 'compose.yaml: services.app: Invalid input: expected object, received null. Fix the field.',
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
