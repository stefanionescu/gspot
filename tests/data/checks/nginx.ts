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

export const CLEAN_NGINX_CONF = `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n        location / {\n            return 204;\n        }\n    }\n}\n`;

export const FORGED_NGINX_CONF = `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n        location ~ /proxy/(.*) {\n            proxy_pass http://$1;\n        }\n    }\n}\n`;

export const NGINX_SERVER = `server {
    listen 443 ssl;
    include /etc/nginx/tls#local.conf;
    location / { proxy_pass "http://api:3000"; }
}
`;

export const NGINX_SCOPE_TABLES = `[tools.nginx]
image = "nginx:1.29.3-alpine@"
[[scope]]
path = "proxy"

configurations = []
[scope.tools.nginx]
image = "nginx:1.29.3-alpine"
`;

export const NGINX_INCLUDE_FILES = {
    'proxy/nginx.conf': 'events {}\nhttp { include "conf.d/*.conf"; }\n',
    'proxy/tls#local.conf': `ssl_certificate "/etc/nginx/ssl/server  certificate.pem"; ssl_certificate_key "/etc/nginx/ssl/server key.pem";
# include /outside/ignored.conf;
`,
    'proxy/unrelated.conf': 'include /outside/not-used.conf;\n',
} as const;

/** An nginx file with dynamic and local targets, which names no host. */
const DYNAMIC_TARGET_CASE = {
    name: 'dynamic and local targets',
    source: 'events {} http { server { server localhost; server unix:/tmp/socket; server ${upstream}; proxy_pass $url; unrelated api; ssl_certificate $cert; ssl_certificate_key /etc/nginx/key.pem; ssl_trusted_certificate /etc/nginx/cert.pem; ssl_certificate /etc/nginx/cert.pem; } }',
    hosts: [],
    certificates: ['/etc/nginx/key.pem', '/etc/nginx/cert.pem'],
} as const;

/** The mount cases: configuration text, the hosts it names, and the certificate paths it reads. */
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
