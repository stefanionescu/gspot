import type { Configuration } from '#cli/types/configurations.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { AvailableSettings } from '#cli/types/settings/inheritance.ts';

/** The error of two configurations with different defaults. */
export const CONFLICTING_DEFAULT_ERRORS = [
    {
        path: ['configurations'],
        message:
            'The configurations sql and alternate-sql set tools.sqlfluff.dialect to different values. Set it yourself in gspot.toml to decide.',
    },
] as const;

/** Settings with an empty PurgeCSS safelist in the root. */
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

/** Two configuration defaults that disagree on the SQL dialect. */
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

/** CSS and HTML naming fields accepted by the published settings schema. */
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
