import { SQL_CHECK_SCRIPT } from '#tests/config/runs/command.ts';
import { findFileTarget } from '#tests/setup/cli/config-files.ts';
import { ALWAYS_SELECTED_REFUSAL } from '#tests/config/commands/configurations.ts';

export const INHERITED_CONFIGURATION_SETTINGS = `configurations = ["markdown", "bash"]
[rules]
enabled = false
[[scope]]
path = "api"
`;

export const TOOLS_CHANGED_NOTE =
    'The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';

export const ALWAYS_SELECTED_RESULTS = {
    text: { code: 2, stdout: '', stderr: `${ALWAYS_SELECTED_REFUSAL}\n` },
    json: {
        code: 2,
        stdout: `${JSON.stringify({ error: 'arguments', message: ALWAYS_SELECTED_REFUSAL }, undefined, 2)}\n`,
        stderr: '',
    },
} as const;

export const UNKNOWN_CONFIGURATION_REFUSALS = ['not-a-real-config-a', 'not-a-real-config-b']
    .map(
        (name) =>
            `There is no configuration called \`${name}\`. Run \`gspot list configurations\` to see the available configurations.\n`,
    )
    .join('');

export const API_BASH_FILES = [findFileTarget('bash', 'semgrep.yml'), findFileTarget('bash', 'shellcheckrc')];

export const SQL_COMMAND_CHECK_TABLES = `[[command_check]]
id = "project/read-sql"
paths = ["**/*.sql"]
stage = "commit"
command = ${JSON.stringify([process.execPath, '-e', SQL_CHECK_SCRIPT, '{files}'])}
`;

export const TEST_VERSION = '0.0.0-test';
