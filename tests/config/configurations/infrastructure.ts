import { CALLED_WORKFLOW } from '#tests/config/setup/configurations.ts';

const CALLED_WORKFLOW_REFERENCES = [
    [`$/${CALLED_WORKFLOW}`, `./${CALLED_WORKFLOW}`],
    [`"$/${CALLED_WORKFLOW}"`, `"./${CALLED_WORKFLOW}"`],
    [String.raw`"\x24/` + `${CALLED_WORKFLOW}"`, String.raw`"\x2e/` + `${CALLED_WORKFLOW}"`],
    [`|-\n          $/${CALLED_WORKFLOW}`, `|-\n          ./${CALLED_WORKFLOW}`],
    [`|- # $comment\n          $/${CALLED_WORKFLOW}`, `|- # $comment\n          ./${CALLED_WORKFLOW}`],
    ['$/.github/workflows/$called.yml', './.github/workflows/$called.yml'],
    [
        'actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0',
        'actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0',
    ],
] as const;

export const ACTIONLINT_EXITS = [
    { code: 0, status: 'passed', findings: [], note: undefined },
    {
        code: 1,
        status: 'failed',
        findings: [{ file: '.github/workflows/caller.yml', rule: 'workflow-call' }],
        note: undefined,
    },
    {
        code: 3,
        status: 'error',
        findings: [],
        note: '<actionlint> failed with exit 3:\n.github/workflows/caller.yml:4:11: located defect [workflow-call]',
    },
] as const;

export const WORKFLOW_TEXT_CASES = [
    ...CALLED_WORKFLOW_REFERENCES.map(([reference, expected]) => ({
        name: `uses ${reference}`,
        path: '.github/workflows/caller.yml',
        before: `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${reference}\n`,
        expected: `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${expected}\n`,
    })),
    {
        name: 'a YAML alias',
        path: '.github/workflows/caller.yml',
        before: `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`,
        expected: `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow ./${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`,
    },
    {
        name: 'an unclosed flow sequence',
        path: '.github/workflows/caller.yml',
        before: 'uses: [$/unclosed\n',
        expected: 'uses: [$/unclosed\n',
    },
];

export const OUTSIDE_GITHUB_ACTIONS = {
    '.github/workflows/caller.yml':
        'on: workflow_dispatch\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: $/actions/setup\n',
    'action.yml': 'name: Root\nruns:\n  using: composite\n  steps:\n    - uses: $/actions/setup\n',
    'actions/setup/action.yml':
        'name: Setup\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: echo safe\n',
} as const;

export const NGINX_UPSTREAM_CONFIG = `events {}
http {
    upstream backend {
        server api:3000;
        server 10.0.0.2:3000;
    }
    server {
        listen 443 ssl;
        server_name example.test;
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        location / {
            proxy_pass http://backend;
        }
    }
}
`;

const DYNAMIC_TARGET_CASE = {
    name: 'dynamic and local targets',
    source: 'events {} http { server { server localhost; server unix:/tmp/socket; server ${upstream}; proxy_pass $url; unrelated api; ssl_certificate $cert; ssl_certificate_key /etc/nginx/key.pem; ssl_trusted_certificate /etc/nginx/cert.pem; ssl_certificate /etc/nginx/cert.pem; } }',
    hosts: [],
    certificates: ['/etc/nginx/key.pem', '/etc/nginx/cert.pem'],
} as const;

export const NGINX_MOUNT_CASES = [
    {
        name: 'certificate paths and upstream hosts',
        source: NGINX_UPSTREAM_CONFIG,
        hosts: ['api:127.0.0.1', 'backend:127.0.0.1'],
        certificates: ['/etc/nginx/ssl/fullchain.pem', '/etc/nginx/ssl/privkey.pem'],
    },
    DYNAMIC_TARGET_CASE,
] as const;

const NGINX_EMERGENCY_CASES = [
    {
        stderr: 'nginx: [emerg] unknown directive "invalid" in /etc/nginx/conf.d/site.conf:7',
        file: 'conf.d/site.conf',
        line: 7,
    },
    { stderr: 'nginx: [emerg] configuration could not be read', file: 'nginx.conf', line: 1 },
] as const;

export const NGINX_FAILURE_CASES = [
    ...NGINX_EMERGENCY_CASES.map(({ stderr, file, line }) => ({
        name: `an emergency at ${file}:${String(line)}`,
        stderr,
        status: 'failed' as const,
        note: undefined,
        findings: [
            {
                file,
                line,
                rule: 'syntax',
                message: stderr,
            },
        ],
    })),
    {
        name: 'an unavailable Docker daemon as missing',
        stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?',
        status: 'missing',
        note: 'Start Docker, then run the check again.',
        findings: [],
    },
] as const;
