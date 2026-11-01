export const CONFLICTING_DEFAULT_ERRORS = [
    {
        path: ['configurations'],
        message:
            'The configurations sql and alternate-sql set tools.sqlfluff.dialect to different values. Set it yourself in gspot.toml to decide.',
    },
] as const;

export const PURGECSS_SAFELIST_TABLES = `[tools.purgecss]
safelist = []
[[scope]]
path = "app"
configurations = []
[[scope]]
path = "app/deep"
configurations = []
[[scope]]
path = "sibling"
removed_configurations = { site = "This scope does not use the inherited site checks." }
`;

export const POSTGRES_ORIGIN = 'configuration postgres';
