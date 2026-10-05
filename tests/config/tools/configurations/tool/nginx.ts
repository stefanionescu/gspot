import { QUIET_INIT } from '#tests/config/harness/init.ts';

export const CLEAN = `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n        location / {\n            return 204;\n        }\n    }\n}\n`;

export const NGINX_INIT = ['init', '--yes', '--configurations', 'nginx', ...QUIET_INIT];

export const FORGED = `events {}\nhttp {\n    server_tokens off;\n    server {\n        listen 8080;\n        location ~ /proxy/(.*) {\n            proxy_pass http://$1;\n        }\n    }\n}\n`;

export const SERVER =
    'server {\n    listen 443 ssl;\n    include /etc/nginx/tls#local.conf;\n    location / { proxy_pass "http://api:3000"; }\n}\n';
