/**
 * One nginx file that the check copies into the container: its repository path, the copy, its path inside the
 * container, and its text.
 */
export type Mount = { path: string; source: string; target: string; text: string };

/**
 * The files that the check mounts into the nginx container: the copied nginx files, and a throwaway certificate and
 * key.
 */
export type NginxMounts = { configs: Pick<Mount, 'source' | 'target'>[]; certificate: string; key: string };
