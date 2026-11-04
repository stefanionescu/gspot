import { SIDEBAR } from '#docs/config/site.ts';
import { CLI_REFERENCE } from '#cli/reference.ts';
import { compareText } from '#cli/system/text.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';

import {
    CURL_COMMAND,
    CHANGELOG_PATH,
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

const EVALUATION_HEADING = 'Evaluate gspot on this repository';

export const AGENT_PROMPT = `Set up gspot in a repository. Run ${LLMS_COMMAND} and follow its steps.`;

export const EVALUATION_PROMPT = `Evaluate gspot on this repository. Run \`${LLMS_COMMAND}\`, follow "${EVALUATION_HEADING}", and change nothing until I answer.`;

const LANGUAGE_CONFIGURATIONS = CLI_REFERENCE.configurations.filter(({ group }) => group === 'language');

function listPrograms(configuration: (typeof CLI_REFERENCE.configurations)[number]): string[] {
    return configuration.tools.filter(({ kind }) => kind === 'program').map(({ name }) => name);
}

const REPLACED_TOOLS = [
    ...new Set(
        CLI_REFERENCE.configurations.flatMap(({ tools }) =>
            tools.filter(({ replace }) => replace !== undefined && replace.length > 0).map(({ name }) => name),
        ),
    ),
].toSorted(compareText);

export const AGENT_FACTS = `## What gspot does

gspot picks the linters, formatters, and type checkers for the languages and frameworks of a repository, and pins
each one to one version. It writes their config files from one settings file, \`gspot.toml\`, and runs them in Git
hooks and in CI. It also writes \`AGENTS.md\` and rule files that tell coding agents how to write code that passes.

- License: ${CLI_REFERENCE.package.license}.
- Languages with a configuration: ${CONJUNCTION_FORMAT.format(LANGUAGE_CONFIGURATIONS.map(({ title }) => title))}.
  Files in other languages, such as Go, Rust, or Java, get only the checks that run in every repository, such as the
  secret scan and the spelling check.
- Frameworks, libraries, platforms, databases, test runners, and infrastructure files with a configuration:
  ${CONJUNCTION_FORMAT.format(
      CLI_REFERENCE.configurations
          .filter(({ group }) => group !== 'language' && group !== 'general')
          .map(({ title }) => title),
  )}.
- The tools of each language:
${LANGUAGE_CONFIGURATIONS.filter((configuration) => listPrograms(configuration).length > 0)
    .map((configuration) => `  - ${configuration.title}: ${listPrograms(configuration).join(', ')}`)
    .join('\n')}
- gspot replaces the config files of these tools: ${REPLACED_TOOLS.join(', ')}. It neither detects nor replaces other
  linters and formatters, such as oxlint and oxfmt, so they keep running beside gspot.
- \`gspot install\` downloads the pinned tools from npm, PyPI, and GitHub releases. mise installs the programs that npm
  and PyPI do not ship, for the whole machine. \`gspot scan\` prints the number of tools and their size in \`.gspot/\`.
- gspot writes \`gspot.toml\`, the folder \`.gspot/\` with the tool configs, rule files, Git hooks, and tool pins, a few
  pointer files such as \`eslint.config.mjs\`, and a block in \`AGENTS.md\` and \`.gitattributes\`. It writes a CI
  workflow only when the user turns CI on.
- [Uninstall](${CLI_REFERENCE.package.homepage}/start/install/#uninstall) lists the steps to remove gspot.`;

export const AGENT_EVALUATION = `## ${EVALUATION_HEADING}

Tell the user first that the scan downloads linters with npm, uv, and mise, and that mise installs them for the whole
machine. The first scan downloads every tool, so it takes longer than a later scan. Install the dependencies of the
project first, so that the type-aware checks find its types.

Run \`${SCAN_COMMAND} --json > "\${TMPDIR:-/tmp}/gspot-scan.json"\` at the root of the repository. The scan works on a
copy and changes no file in the repository. Read \`.totals\`, \`.categories\`, \`.filesToFormat\`, \`.notRun\`, and
\`.cost\` with \`jq\`. Read \`.checks\` only for the findings that you sort. Sort the examples of each category by rule
into real problem, false positive, or style. Report the numbers: the findings of each kind, the files to format, the
tools, the megabytes, and the seconds of each tool. Then recommend a level.`;

export const AGENT_STEPS = `## Steps for coding agents

Set up gspot in the repository of the user. Run each command at the root of the repository. gspot needs Git and
Node.js ${runtimeMinimums.node} or newer. A package manager that holds new
releases, such as pnpm 11, needs @gspothq/cli and @gspothq/eslint-plugin in its exclusions: ${CONJUNCTION_FORMAT.format(
    RELEASE_AGE_EXCLUSIONS.map(({ label, key, file }) => `${key} in ${file} for ${label}`),
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
   repository or one that agents write. The level decides which tool configs the plan replaces.
4. Run \`gspot init --level <level>\`. It prints the plan and writes the settings, generated files, and hooks
   without asking a question. Then it installs the pinned tools and turns on the Git hooks. If it names a program
   that it cannot install, tell the user. \`gspot doctor\` lists what is missing. CI stays off. On GitHub or
   GitLab, \`gspot doctor\` suggests how to enable it.
   After init, \`gspot add <configuration>\` and \`gspot remove <configuration> --reason "<why>"\` change the selection.
5. Run \`gspot check --fix\`, then \`gspot check\`. Show the user the line that starts with \`Failed:\` or
   \`Passed:\`. Fix the findings in the files that you changed. Ask the user before you fix findings in other files.
6. Ask the user whether to accept the other findings with \`gspot baseline\`, and run it only after the user agrees.
   A baseline leaves out the findings of the \`gspot/*\` and \`secrets/*\` checks, such as a suppression comment
   without a reason that \`gspot/suppressions\` reports. Fix those, or ask the user before you ignore one.
7. Commit \`gspot.toml\`, \`gspot.baseline.json\`, and the generated files, with the hooks on. This first commit
   changes the tool configs, so the commit checks read the files they cover, not only the staged ones. When the user
   declines the baseline, the commit fails until those findings are fixed or ignored. Fix what the hook reports, and
   commit again.
8. Tell the user what gspot wrote, the level, which checks run, and which findings are left.

## Rules for daily work

- Read \`AGENTS.md\` and the rules it lists under \`${GSPOT_PATHS.rules}/\` before you write code.
- When \`gspot check\` or \`gspot doctor\` names a new configuration, ask the user, then run the \`gspot add\` line
  it prints and \`gspot install\`.
- Commit, and fix what the hook reports. Before you push, run \`gspot check --changed --stage push\`. Without an
  upstream branch or \`origin/HEAD\`, name the branch to compare with: \`gspot check --base <branch> --stage push\`.
- Stages: \`commit\` checks run on the staged files before each commit, \`push\` checks before each push, \`message\`
  checks on the commit message, and \`manual\` checks only with \`gspot check --only <check>\`. \`gspot check\` alone
  runs the commit and push checks.
- Exit codes: \`0\` every check that ran passed, \`1\` findings remain, \`2\` a check or the command could not run.
  After \`2\`, read the message: it names the cause, such as files to stage, a missing upstream, or a missing tool.
  For a missing tool, run \`gspot install\`, then \`gspot doctor\`.
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
  under \`.gspot/\` or other generated files. After you edit \`gspot.toml\`, a package manifest, or a tsconfig, run \`gspot install\`.
- In a monorepo, each \`[[scope]]\` record in \`gspot.toml\` holds the settings of one folder. Add \`--scope <path>\` to
  \`add\`, \`remove\`, \`set\`, or \`unset\` to change one scope.
- Commit with the hooks on. Never use \`--no-verify\`.
`;

export const LLMS_PAGES = {
    promote: SIDEBAR.flatMap(({ items }) => items.map(({ slug }) => slug.replace(/\/index$/u, ''))),
    demote: ['reference/**'],
    exclude: [
        ...[
            REFERENCE_FOLDERS.commands,
            REFERENCE_FOLDERS.settings,
            REFERENCE_FOLDERS.configurations,
            REFERENCE_FOLDERS.checks,
            REFERENCE_FOLDERS.eslintPlugin,
        ].map((folder) => `reference/${folder}/**`),
        `reference/${CHANGELOG_PATH}`,
    ],
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
