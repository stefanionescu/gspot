import { posix } from 'node:path';
import { directives } from '#cli/checks/tool/nginx/directives.ts';
import { LOCAL_NAMES, HOST_PATTERNS } from '#cli/config/checks/tool/nginx.ts';

/**
 * The docker arguments that run nginx -t over one configuration file.
 * @param text the configuration.
 * @param mounts the host paths: the configuration, the certificate, and the key.
 * @param mounts.configs the captured configuration files and container paths.
 * @param mounts.certificate the throwaway certificate.
 * @param mounts.key the throwaway key.
 * @param image the nginx image.
 * @returns the argv after docker.
 */
export function testArguments(
    text: string,
    mounts: { configs: { source: string; target: string }[]; certificate: string; key: string },
    image: string,
): string[] {
    const parsed = directives(text);
    const hosts = new Set(
        parsed.flatMap(([name, value]) => {
            if (value === undefined || value.includes('$')) return [];
            const host = HOST_PATTERNS.get(name)?.exec(value)?.[1];
            return host === undefined || LOCAL_NAMES.has(host) ? [] : [host];
        }),
    );
    const certificates = new Map([
        ['ssl_certificate_key', mounts.key],
        ['ssl_certificate', mounts.certificate],
        ['ssl_trusted_certificate', mounts.certificate],
    ]);
    const volumes = [
        ...mounts.configs.map(({ source, target }) => `${source}:${target}:ro`),
        ...parsed.flatMap(([name, path]) => {
            if (path === undefined || path.includes('$')) return [];
            const source = certificates.get(name);
            return source === undefined ? [] : [`${source}:${posix.resolve('/etc/nginx', path)}:ro`];
        }),
    ];
    return [
        'run',
        '--rm',
        ...[...hosts].flatMap((host) => ['--add-host', `${host}:127.0.0.1`]),
        ...[...new Set(volumes)].flatMap((volume) => ['-v', volume]),
        image,
        'nginx',
        '-T',
    ];
}
