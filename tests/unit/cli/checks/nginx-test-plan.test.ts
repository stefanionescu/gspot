import { describe, expect, test } from 'bun:test';
import { nginxTestArguments } from '#cli/checks/nginx/test-plan.ts';
import { NGINX_TEST_PLAN_CONFIG } from '#tests/constants/unit/cli/checks/checks.ts';

describe('nginxTestArguments', () => {
    test('mounts the file, a certificate and a key where the file opens them, and resolves the names it uses', () => {
        const mounts = {
            configs: [{ source: '/repo/nginx.conf', target: '/etc/nginx/nginx.conf' }],
            certificate: '/work/certificate.pem',
            key: '/work/key.pem',
        };
        expect(nginxTestArguments(NGINX_TEST_PLAN_CONFIG, mounts, 'nginx:1.29.3-alpine')).toStrictEqual([
            'run',
            '--rm',
            '--add-host',
            'api:127.0.0.1',
            '--add-host',
            'backend:127.0.0.1',
            '-v',
            '/repo/nginx.conf:/etc/nginx/nginx.conf:ro',
            '-v',
            '/work/certificate.pem:/etc/nginx/ssl/fullchain.pem:ro',
            '-v',
            '/work/key.pem:/etc/nginx/ssl/privkey.pem:ro',
            'nginx:1.29.3-alpine',
            'nginx',
            '-T',
        ]);
    });
});
