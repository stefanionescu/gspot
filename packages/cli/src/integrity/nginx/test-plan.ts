// What nginx -t needs to accept a file outside its server: the certificate paths it opens and the upstream names it resolves.
import { capturedLines } from '#cli/integrity/captured-lines.ts';
import { NGINX_CERTIFICATE, NGINX_KEY, NGINX_UPSTREAM } from '#config/integrity.ts';

const LOCAL_NAMES = new Set(['localhost', 'unix']);

/**
 * The docker arguments that run nginx -t over one configuration file.
 * @param text the configuration
 * @param mounts the host paths: the configuration, the certificate and the key
 * @param mounts.config the configuration file
 * @param mounts.certificate the throwaway certificate
 * @param mounts.key the throwaway key
 * @param image the nginx image
 * @returns the argv after docker
 */
export function nginxTestArguments(
    text: string,
    mounts: { config: string; certificate: string; key: string },
    image: string,
): string[] {
    const hosts = capturedLines(text, NGINX_UPSTREAM).filter((host) => !LOCAL_NAMES.has(host));
    const volumes = [
        `${mounts.config}:/etc/nginx/nginx.conf:ro`,
        ...capturedLines(text, NGINX_CERTIFICATE).map((path) => `${mounts.certificate}:${path}:ro`),
        ...capturedLines(text, NGINX_KEY).map((path) => `${mounts.key}:${path}:ro`),
    ];
    return [
        'run',
        '--rm',
        ...hosts.flatMap((host) => ['--add-host', `${host}:127.0.0.1`]),
        ...volumes.flatMap((volume) => ['-v', volume]),
        image,
        'nginx',
        '-t',
    ];
}
