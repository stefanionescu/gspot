/** gspot owns this directive; tool-specific directives belong to their manifests. */
export const GSPOT_SUPPRESSION = {
    marker: 'gspot-ignore +[a-z0-9-]+/[a-z0-9-]+',
    reason: ' -- (?<reason>\\S.*)',
};
