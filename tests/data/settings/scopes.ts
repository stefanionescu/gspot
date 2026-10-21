import { LocalDate } from '@decimalturn/toml-patch';

export const NESTED_SCOPE_SETTINGS = `configurations = ["bash", "swift", "structure"]
[rules]
enabled = false
[limits.bash]
file_lines = 100
[tools.swiftlint]
always_keep_imports = ["Foundation"]
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/**"]
reason = "The api scripts pass word lists on purpose."
[[scope]]
path = "api"
configurations = ["bash"]
limits.bash.file_lines = 80
swift.xcode_scheme = "6.0"
tools.swiftlint.always_keep_imports = ["UIKit"]
[[scope]]
path = "api/v1"
configurations = ["bash"]
limits.bash.file_lines = 60
swift.xcode_scheme = "5.0"
tools.swiftlint.always_keep_imports = ["SwiftUI"]
[[scope]]
path = "web"
configurations = ["bash"]

[swift]
xcode_scheme = "5.0"
`;

export const TWO_SCOPES_SETTINGS = `configurations = []
[[scope]]
path = "api"
configurations = []
[[scope]]
path = "web"
configurations = []
`;

export const LAYERED_SCOPE_SETTINGS = `level = "all"
configurations = ["format"]
[limits]
file_lines = 250
[format]
indent_width = 4
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
limits.file_lines = 200
format.indent_width = 2
[[scope]]
path = "api/worker"
configurations = ["sql"]
limits.sql.file_lines = 30
tools.sqlfluff.dialect = "postgres"
`;
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

export const IGNORE_EXPIRY_ENTRIES = [
    { check: 'dependencies/osv-scanner', rule: 'permanent', reason: 'Reviewed upstream.' },
    {
        check: 'dependencies/osv-scanner',
        rule: 'past',
        reason: 'Reviewed upstream.',
        until: new LocalDate('2030-05-19'),
    },
    {
        check: 'dependencies/osv-scanner',
        rule: 'today',
        reason: 'Reviewed upstream.',
        until: new LocalDate('2030-05-20'),
    },
    {
        check: 'dependencies/osv-scanner',
        rule: 'future',
        reason: 'Reviewed upstream.',
        until: new LocalDate('2030-05-21'),
    },
] as const;

/** The nearest configuration choices apply to child folders, and siblings stay apart. */
export const PROJECT_CHOICES = {
    configurations: ['nextjs', 'javascript'],
    removed_configurations: [],
    scope: [
        { path: 'app', configurations: [], removed_configurations: ['nextjs'] },
        { path: 'app/worker', configurations: ['nextjs'], removed_configurations: [] },
        { path: 'required', configurations: [], removed_configurations: ['javascript'] },
    ],
} as const;

/** Inheritance from the root, removal, restoring in a deeper scope, separate siblings, and required dependencies. */
export const PROJECT_SELECTIONS = [
    ['', 'nextjs', true],
    ['app', 'nextjs', false],
    ['app/child', 'nextjs', false],
    ['app/worker', 'nextjs', true],
    ['sibling', 'nextjs', true],
    ['required', 'javascript', true],
] as const;
