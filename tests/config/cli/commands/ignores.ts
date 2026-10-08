// A check that records what it saw and passes corrected inputs, and a fixer that corrects them.
export const QUALITY_COMMAND = [
    'node',
    '-e',
    String.raw`const fs = require("node:fs"); const paths = process.argv.slice(1); fs.appendFileSync("checked.txt", JSON.stringify(paths) + "\n"); process.exit(paths.some(path => fs.readFileSync(path, "utf8") !== "corrected\n") ? 1 : 0);`,
    '--',
    '{files}',
];

export const QUALITY_FIX = [
    'node',
    '-e',
    String.raw`const fs = require("node:fs"); const paths = process.argv.slice(1); fs.appendFileSync("fixed.txt", JSON.stringify(paths) + "\n"); for (const path of paths) fs.writeFileSync(path, "corrected\n");`,
    '--',
    '{files}',
];

/** Two independent accepted ShellCheck findings for verifying selective removal. */
export const TWO_RULES = `configurations = ["bash"]
[agent_rules]
enabled = false
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "Word lists pass through on purpose."
[[ignore]]
check = "bash/shellcheck"
rule = "SC2034"
reason = "The variables are read by sourcing scripts."
`;

/** Authored ignore commands preserve the policy on a typo or an absent entry. */
export const IGNORE_CASES = [
    ['an unknown check', ['ignore', 'bash/shelcheck', '--reason', 'A typo of the check.'], 2, 'bash/shellcheck'],
    [
        'the removal of an entry that does not exist',
        ['ignore', 'bash/shellcheck', '--rule', 'SC1000', '--remove'],
        0,
        'nothing to remove: no matching ignore entry',
    ],
] as const;

/** Removal must retain apply feedback even when it only deletes an empty authored list. */
export const IGNORE_FEEDBACK_CASES = [
    [
        'an authored entry',
        '[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\nreason = "Word splitting is intentional in this sandbox."\n',
        'removed 1 ignore entry for bash/shellcheck',
    ] as const,
    ['an empty authored list', 'ignore = []\n', 'nothing to remove: no matching ignore entry'] as const,
];
