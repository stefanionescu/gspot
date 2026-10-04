/** One repository configuration copied for a container mount. */
export type Mount = { path: string; source: string; target: string; text: string };

/** Configuration and temporary TLS mounts for validating nginx inside its container. */
export type NginxMounts = { configs: Pick<Mount, 'source' | 'target'>[]; certificate: string; key: string };
