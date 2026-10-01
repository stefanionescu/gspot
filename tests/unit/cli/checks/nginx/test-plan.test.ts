import { test, expect, describe } from 'bun:test';
import { nginxTestArguments } from '#cli/checks/nginx/test-plan.ts';
import { NGINX_TEST_PLAN_CONFIG } from '#tests/inputs/unit/cli/checks/checks.ts';

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

test('dynamic and local nginx targets stay unresolved and repeated certificate mounts are deduplicated', () => {
    const source =
        'events {} http { server { server localhost; server unix:/tmp/socket; server ${upstream}; proxy_pass $url; unrelated api; ssl_certificate $cert; ssl_certificate_key /etc/nginx/key.pem; ssl_trusted_certificate /etc/nginx/cert.pem; ssl_certificate /etc/nginx/cert.pem; } }';
    expect(
        nginxTestArguments(source, { configs: [], key: '/work/key', certificate: '/work/cert' }, 'nginx:fixture'),
    ).toStrictEqual([
        'run',
        '--rm',
        '-v',
        '/work/key:/etc/nginx/key.pem:ro',
        '-v',
        '/work/cert:/etc/nginx/cert.pem:ro',
        'nginx:fixture',
        'nginx',
        '-T',
    ]);
});

test('empty directive input adds no mount or host', () => {
    expect(
        nginxTestArguments(
            '# Empty configuration.\n;{};',
            { configs: [], key: '/work/key', certificate: '/work/cert' },
            'nginx:fixture',
        ),
    ).toStrictEqual(['run', '--rm', 'nginx:fixture', 'nginx', '-T']);
});
