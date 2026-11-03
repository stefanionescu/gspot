import { SIDEBAR } from '#docs/config/site.ts';
import { CLI_REFERENCE } from '#cli/reference.ts';

import {
    CURL_COMMAND,
    REFERENCE_FOLDERS,
    DISJUNCTION_FORMAT,
    CONJUNCTION_FORMAT,
    RELEASE_AGE_EXCLUSIONS,
} from '#docs/config/reference.ts';

export const { runtimeMinimums, packageManagerMinimums, setup, yarnClassicInstall, cloneInstalls, runners } =
    CLI_REFERENCE;

const REFERENCE_URL = CLI_REFERENCE.docs.reference;

export const LLMS_URL = `${CLI_REFERENCE.package.homepage}/llms.txt`;

export const LLMS_COMMAND = `${CURL_COMMAND} ${LLMS_URL}`;

export const SCAN_COMMAND = `npx ${CLI_REFERENCE.package.name} scan`;

export const AGENT_PROMPT = `Set up gspot in a repository. Run ${LLMS_COMMAND} and follow its steps.`;

export const AGENT_EVALUATION = `## Evaluate gspot on this repository

Run \`${SCAN_COMMAND} --json\` at the root of the repository. It works on a copy, so the repository does not change.
Sort each finding into real problem, false positive, or style. Quote the numbers: the findings of each kind, the files
to format, the tools, the megabytes, and the seconds per hook.`;

export const AGENT_STEPS = `## Steps for coding agents

Set up gspot in the repository of the user. Run each command at the root of the repository. gspot needs Git and
Node.js ${runtimeMinimums.node} or newer. A package manager that holds new
releases, such as pnpm 11, needs @gspothq/cli and @gspothq/eslint-plugin in its exclusions: ${CONJUNCTION_FORMAT.format(
    RELEASE_AGE_EXCLUSIONS.map(({ label, key }) => `${key} for ${label}`),
)}.

1. Add gspot, pinned to one version, with the package manager of the repository, or with mise when the repository
   has no \`package.json\`:
${setup.map(({ label, add }) => `   - ${label}: \`${add}\``).join('\n')}

${setup.flatMap(({ label, prerequisites }) => prerequisites.map((command) => `   With ${label}, run \`${command}\` first, so that gspot uses a supported runtime.`)).join('\n')}
   Start the next commands with ${DISJUNCTION_FORMAT.format(setup.map(({ start }) => `\`${start}\``))}.
2. Run \`gspot scan\`. It changes nothing in the repository. Show the user its findings and the plan of init at the
   default level.
3. Ask the user which level, and wait for the answer. ${CLI_REFERENCE.levelSummaries.basic} ${CLI_REFERENCE.levelSummaries.all} Level \`all\` also
   installs a few more tools. Suggest \`basic\`, the default, for an existing codebase, and \`all\` for a new
   repository or one that agents write. The level decides which config files the plan replaces.
4. Run \`gspot init --level <level>\`. It prints the plan and writes the settings, generated files, and hooks
   without asking a question. CI stays off; \`gspot doctor\` suggests how to enable it.
   After init, \`gspot add <configuration>\` and \`gspot remove <configuration> --reason "<why>"\` change the selection.
5. Run \`gspot install\`. It installs the pinned tools and turns on the Git hooks. If it names a program that it
   cannot install, tell the user. \`gspot doctor\` lists what is missing.
6. Run \`gspot check\`, and show the user its last line. Fix the findings in the files that you changed. Ask the user
   before you fix findings in other files.
7. Ask the user whether to accept the other findings with \`gspot baseline\`, and run it only after the user agrees.
8. Tell the user what gspot wrote, the level, which checks run, and which findings are left.

## Rules for daily work

- Read \`AGENTS.md\` and the rules it lists under \`.gspot/configurations/\` before you write code.
- When \`gspot check\` or \`gspot doctor\` names a new configuration, ask the user, then run the \`gspot add\` line
  it prints and \`gspot install\`.
- Before you commit, run \`gspot check --staged --stage commit\`. Before you push, run
  \`gspot check --changed --stage push\`.
- Stages: \`commit\` checks run on the staged files before each commit, \`push\` checks before each push, \`message\`
  checks on the commit message, and \`manual\` checks only with \`gspot check --only <check>\`. \`gspot check\` alone
  runs the commit and push checks.
- Exit codes: \`0\` every check that ran passed, \`1\` findings remain, \`2\` a check could not run. After \`2\`, run
  \`gspot install\`, then \`gspot doctor\`.
- \`gspot explain <check, setting, or file>\` explains it and names the commands that change it.
  For a lint rule, use \`gspot explain <check> <rule>\`.
  \`gspot check --fix\` runs the formatters and other fixers. The check \`<configuration>/<name>\` has a section
  at ${CLI_REFERENCE.docs.configurations}<configuration>/#<name>.
- Fix the code first. Ask the user before you ignore a finding, remove a configuration, or raise a limit; each takes
  \`--reason "<why>"\`. To ignore a finding:
  \`gspot ignore <check> --reason "<why>"\`, with \`--rule <rule>\` and \`--paths "<path>"\` to narrow it.
  A suppression comment needs a reason, such as
  \`// eslint-disable-next-line no-console -- reason: the command prints its result\`.
- Ask the user before you run \`gspot baseline\`, which accepts every current finding. When \`gspot/baseline\`
  reports a stale count, run \`gspot baseline --prune\` and commit \`gspot.baseline.json\`.
- Never suppress a size or complexity limit. Split the code, or ask the user to raise the limit with
  \`gspot set limits.<name> <value> --reason "<why>"\`.
- Change settings only with \`gspot add\`, \`remove\`, \`set\`, \`unset\`, \`ignore\`, and \`unignore\`. Do not edit files
  under \`.gspot/\` or other generated files. After you edit \`gspot.toml\`, a package manifest, or a tsconfig, run \`gspot apply\`.
- In a monorepo, each \`[[scope]]\` record in \`gspot.toml\` holds the settings of one folder. Add \`--scope <path>\` to
  \`add\`, \`remove\`, \`set\`, or \`unset\` to change one scope.
- Commit with the hooks on. Never use \`--no-verify\`.
`;

export const LLMS_PAGES = {
    promote: SIDEBAR.flatMap(({ items }) => items.map(({ slug }) => slug.replace(/\/index$/u, ''))),
    demote: ['reference/**'],
    exclude: [
        REFERENCE_FOLDERS.commands,
        REFERENCE_FOLDERS.settings,
        REFERENCE_FOLDERS.configurations,
        REFERENCE_FOLDERS.checks,
        REFERENCE_FOLDERS.eslintPlugin,
    ].map((folder) => `reference/${folder}/**`),
    minify: { whitespace: false },
    customSets: [
        {
            label: 'Reference',
            paths: ['reference/**'],
            description: 'every command, gspot.toml setting, configuration, check, and ESLint plugin rule',
        },
    ],
    customSelectors: { all: ['.sl-anchor-link'] },
    optionalLinks: [
        {
            label: 'Commands',
            url: `${REFERENCE_URL}${REFERENCE_FOLDERS.commands}/`,
            description: 'every command, its options, and exit codes',
        },
        {
            label: 'gspot.toml settings',
            url: `${REFERENCE_URL}${REFERENCE_FOLDERS.settings}/`,
            description: 'every key of gspot.toml, its accepted values, and its default',
        },
        {
            label: 'JSON output',
            url: `${REFERENCE_URL}${REFERENCE_FOLDERS.jsonOutput}/`,
            description: 'the fields of gspot check --json',
        },
    ],
};
