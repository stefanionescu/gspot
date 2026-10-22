import { SQL_CHECK_SCRIPT } from '#tests/config/runs/command.ts';
import { ALWAYS_SELECTED_REFUSAL } from '#tests/config/commands/configurations.ts';

export const INHERITED_CONFIGURATION_SETTINGS = `configurations = ["markdown", "bash"]
[rules]
enabled = false
[[scope]]
path = "api"
`;

/** The note of an apply whose tool pins changed. */
export const TOOLS_CHANGED_NOTE =
    'The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';

/** What add and remove print, in text and in JSON, when they refuse an always-selected configuration. */
export const ALWAYS_SELECTED_RESULTS = {
    text: { code: 2, stdout: '', stderr: `${ALWAYS_SELECTED_REFUSAL}\n` },
    json: {
        code: 2,
        stdout: `${JSON.stringify({ error: 'arguments', message: ALWAYS_SELECTED_REFUSAL }, undefined, 2)}\n`,
        stderr: '',
    },
} as const;

/** The refusal of two configuration names that no manifest declares. */
export const UNKNOWN_CONFIGURATION_REFUSALS = ['not-a-real-config-a', 'not-a-real-config-b']
    .map(
        (name) =>
            `There is no configuration called \`${name}\`. Run \`gspot list configurations\` to see the available configurations.\n`,
    )
    .join('');

/** The Bash files of the api scope that apply writes, and that a removal deletes. */
export const API_BASH_FILES = [
    '.gspot/configurations/language/bash/semgrep.yml',
    '.gspot/configurations/language/bash/shellcheckrc',
];

export const SQL_COMMAND_CHECK_TABLES = `[[command_check]]
id = "project/read-sql"
paths = ["**/*.sql"]
stage = "commit"
command = ${JSON.stringify([process.execPath, '-e', SQL_CHECK_SCRIPT, '{files}'])}
`;

/** A gspot version that no release has. Version pins and reports in the tests use it. */
export const TEST_VERSION = '0.0.0-test';
