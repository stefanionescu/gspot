export const OVERRIDING_GROUPS = new Set<string>(['framework', 'platform', 'library', 'database']);

export const OPENNEXT_PACKAGE = '@opennextjs/cloudflare';

export const OPENNEXT_TYPE_DEFAULTS = {
    'cloudflare.types_file': 'cloudflare-env.d.ts',
    'cloudflare.types_interface': 'CloudflareEnv',
} as const;

export const PATH_ROLES = ['source', 'destination', 'build'] as const;

export const BUILD_SCRIPT = ['run', 'build'] as const;
