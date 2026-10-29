export const NGINX_UPSTREAM_CONF = `events {}
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
        source: NGINX_UPSTREAM_CONF,
        hosts: ['api:127.0.0.1', 'backend:127.0.0.1'],
        certificates: ['/etc/nginx/ssl/fullchain.pem', '/etc/nginx/ssl/privkey.pem'],
    },
    DYNAMIC_TARGET_CASE,
    { name: 'empty directives', source: '# Empty configuration.\n;{};', hosts: [], certificates: [] },
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
                check: 'nginx/syntax',
                file,
                line,
                rule: 'syntax',
                fixable: false,
                message: stderr,
                help: 'Fix the line nginx names. Set `tools.nginx.image` to the one your deployment runs.',
            },
        ],
    })),
    {
        name: 'an unavailable Docker daemon as missing',
        stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?',
        status: 'missing',
        note: 'Start Docker: nginx/syntax runs nginx -T in a container.',
        findings: [],
    },
] as const;
