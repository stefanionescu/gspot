export const NGINX_CONFIGURATION = `events {}
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

export const CLEAN_NGINX_CONFIG = `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n        location / {\n            return 204;\n        }\n    }\n}\n`;

export const FORGED_NGINX_CONFIG = `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n        location ~ /proxy/(.*) {\n            proxy_pass http://$1;\n        }\n    }\n}\n`;

export const NGINX_SERVER = `server {
    listen 443 ssl;
    include /etc/nginx/tls#local.conf;
    location / { proxy_pass "http://api:3000"; }
}
`;

export const NGINX_SCOPE_SETTINGS = `[tools.nginx]
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

export const NGINX_DIRECTIVE_CASES = [
    {
        source: 'location / { proxy_pass "https://api:3000"; add_header X-Value "two  spaces # text"; }',
        expected: [
            ['location', '/'],
            ['proxy_pass', 'https://api:3000'],
            ['add_header', 'X-Value', 'two  spaces # text'],
        ],
    },
    {
        source: 'set $empty ""; set $value ${upstream}; include /etc/tls#local.conf; # include /ignored;\n',
        expected: [
            ['set', '$empty', ''],
            ['set', '$value', '${upstream}'],
            ['include', '/etc/tls#local.conf'],
        ],
    },
    {
        source: String.raw`set $value "tab\tnewline\nreturn\rquote\"slash\\";`,
        expected: [['set', '$value', 'tab\tnewline\nreturn\rquote"slash\\']],
    },
] as const;
