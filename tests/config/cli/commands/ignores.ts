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
