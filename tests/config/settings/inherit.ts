import type { Configuration } from '#cli/types/configurations.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { AvailableSettings } from '#cli/types/settings/inheritance.ts';

export const REPLACED_LIST_DEFAULTS = [
    {
        key: 'ci.operating_systems',
        configurations: [],
        tables: '[ci]\noperating_systems = ["macos"]\n',
        value: ['macos'],
    },
    {
        key: 'supabase.schemas',
        configurations: ['supabase'],
        tables: '[supabase]\nschemas = ["api"]\n',
        value: ['api'],
    },
    {
        key: 'tools.semgrep.registry_packs',
        configurations: ['security'],
        tables: '[tools.semgrep]\nregistry_packs = []\n',
        value: [],
    },
    {
        key: 'tools.commitlint.types',
        configurations: ['commits'],
        tables: '[tools.commitlint]\ntypes = ["feat", "fix"]\n',
        value: ['feat', 'fix'],
    },
    {
        key: 'tools.trivy.severity',
        configurations: ['docker'],
        tables: '[tools.trivy]\nseverity = ["CRITICAL"]\n',
        value: ['CRITICAL'],
    },
    { key: 'test_files', configurations: [], tables: 'test_files = ["spec/**"]\n', value: ['spec/**'] },
];

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
removed_configurations = { value = ["site"], reason = "This scope does not use the inherited site checks." }
`;

const sqlConfiguration = readConfigurations().get('sql') as Configuration;

export const CONFLICTING_SETTINGS: AvailableSettings = buildAvailableSettings(
    [
        sqlConfiguration,
        {
            ...sqlConfiguration,
            name: 'alternate-sql',
            defaults: { 'tools.sqlfluff.dialect': 'postgres' },
        },
    ],
    'recommended',
);

export const CSS_HTML_NAMING_SETTINGS = `configurations = ["css", "html"]
[naming.css]
max_words = 3
max_characters = 20
cases = { value = ["kebab"], reason = "CSS and HTML file names use kebab case." }
[naming.css.files]
max_words = 3
max_characters = 20
cases = { value = ["kebab"], reason = "CSS and HTML file names use kebab case." }
[naming.html.folders]
max_words = 3
max_characters = 20
cases = { value = ["kebab"], reason = "CSS and HTML file names use kebab case." }
`;

export const PURGECSS_SCOPE_CONFIGURATIONS = [
    'html',
    'site',
    'data-files',
    'dependencies',
    'docs',
    'duplication',
    'engineering',
    'format',
    'gspot',
    'naming',
    'prose',
    'repository',
    'secrets',
    'security',
    'spelling',
    'structure',
];

export const PURGECSS_SIBLING_CONFIGURATIONS = [
    'data-files',
    'dependencies',
    'docs',
    'duplication',
    'engineering',
    'format',
    'gspot',
    'naming',
    'prose',
    'repository',
    'secrets',
    'security',
    'spelling',
    'structure',
];
