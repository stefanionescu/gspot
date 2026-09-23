// What nginx -t needs to accept a file outside its server: the certificate paths it opens and the upstream names it resolves.
import { nginxDirectives } from '#cli/checks/nginx/directives.ts';
import { posix } from 'node:path';

const LOCAL_NAMES = new Set(['localhost', 'unix']);

/**
 * The docker arguments that run nginx -t over one configuration file.
 * @param text the configuration
 * @param mounts the host paths: the configuration, the certificate and the key
 * @param mounts.configs the captured configuration files and container paths
 * @param mounts.certificate the throwaway certificate
 * @param mounts.key the throwaway key
 * @param image the nginx image
 * @returns the argv after docker
 */
export function nginxTestArguments(
    text: string,
    mounts: { configs: { source: string; target: string }[]; certificate: string; key: string },
    image: string,
): string[] {
    const directives = nginxDirectives(text);
    const hosts = new Set(
        directives.flatMap(([name, value]) => {
            if (value === undefined || value.includes('$')) return [];
            const host = (
                name === 'proxy_pass'
                    ? /^https?:\/\/([A-Za-z][\w.-]*)/u
                    : name === 'server'
                      ? /^([A-Za-z][\w.-]*)/u
                      : undefined
            )?.exec(value)?.[1];
            return host === undefined || LOCAL_NAMES.has(host) ? [] : [host];
        }),
    );
    const volumes = [
        ...mounts.configs.map(({ source, target }) => `${source}:${target}:ro`),
        ...directives.flatMap(([name, path]) => {
            if (path === undefined || path.includes('$')) return [];
            const source =
                name === 'ssl_certificate_key'
                    ? mounts.key
                    : name === 'ssl_certificate' || name === 'ssl_trusted_certificate'
                      ? mounts.certificate
                      : undefined;
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
