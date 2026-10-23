// Defaults of single values from these configuration groups win over the defaults of other groups.
export const OVERRIDING_GROUPS = new Set<string>(['framework', 'platform', 'library', 'database']);

export const OPENNEXT_PACKAGE = '@opennextjs/cloudflare';

/** The types file and interface that the OpenNext guide passes to wrangler types. */
export const OPENNEXT_TYPE_DEFAULTS = {
    'cloudflare.types_file': 'cloudflare-env.d.ts',
    'cloudflare.types_interface': 'CloudflareEnv',
} as const;

export const PATH_ROLES = ['source', 'destination', 'build'] as const;

export const BUILD_SCRIPT = ['run', 'build'] as const;
