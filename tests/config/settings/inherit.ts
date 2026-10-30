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

export const POSTGRES_ORIGIN = 'configuration postgres';
