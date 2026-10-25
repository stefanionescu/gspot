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
