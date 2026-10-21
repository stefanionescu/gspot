import { buildKnownSettings } from '#cli/settings/known.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { KnownSettings } from '#cli/types/settings/inheritance.ts';

export const DEFAULT_CASES = [
    {
        name: `defaults are omitted`,
        source: `level="recommended"
removed_configurations=[]
tool_timeout_seconds=600
[hooks]
enabled=false
[format]
indent_style="space"
indent_width=4
`,
        expected: `
`,
    },
    {
        name: `scope restores default after parent override`,
        source: `[format]
indent_width=2
[[scope]]
path="app"
format.indent_width=4
[[scope]]
path="app/worker"
format.indent_width=4
[[scope]]
path="notes"
format.indent_width=2
`,
        expected: `[format]
indent_width = 2

[[scope]]
path = "app"
format.indent_width = 4

[[scope]]
path = "app/worker"

[[scope]]
path = "notes"
`,
    },
    {
        name: `language default restores root limit`,
        source: `[limits]
file_lines={value=500,reason="Reviewed root files need this ceiling."}
[[scope]]
path="app"
limits.python.file_lines=300
[[scope]]
path="app/worker"
limits.python.file_lines=300
`,
        expected: `[limits]
file_lines = { value = 500, reason = "Reviewed root files need this ceiling." }

[[scope]]
path = "app"
limits.python.file_lines = 300

[[scope]]
path = "app/worker"
`,
    },
] as const;

const sqlConfiguration = readConfigurations().get('sql') as Configuration;

/** Two configuration defaults that disagree on the SQL dialect. */
export const CONFLICTING_SETTINGS: KnownSettings = buildKnownSettings(
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
