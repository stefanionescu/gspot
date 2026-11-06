import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { CLI_REFERENCE } from '#cli/reference.ts';
import { compareText } from '#cli/system/text.ts';
import {
    CHANGELOG_PATH,
    CONJUNCTION_FORMAT,
    CURL_COMMAND,
    DISJUNCTION_FORMAT,
    REFERENCE_FOLDERS,
    RELEASE_AGE_EXCLUSIONS,
} from '#docs/config/reference.ts';
import { SIDEBAR } from '#docs/config/site.ts';

export const { runtimeMinimums, packageManagerMinimums, setup, yarnClassicInstall, cloneInstalls, hookProgramMissing } =
    CLI_REFERENCE;

const REFERENCE_URL = CLI_REFERENCE.docs.reference;

export const LLMS_URL = `${CLI_REFERENCE.package.homepage}/llms.txt`;

export const LLMS_COMMAND = `${CURL_COMMAND} ${LLMS_URL}`;

const SCAN_COMMAND = `npx ${CLI_REFERENCE.package.name} scan`;

const EVALUATION_HEADING = 'Try gspot before installing it';

export const AGENT_PROMPT = `Set up gspot in my repository. Run ${LLMS_COMMAND} and follow its steps.`;

export const EVALUATION_PROMPT = `Show me what gspot would find in my repository. Run \`${LLMS_COMMAND}\`, follow "${EVALUATION_HEADING}", and change nothing until I answer.`;

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

gspot sets up linters, formatters, and type checkers for the languages and frameworks in a repository, and pins each
tool that it installs. It writes the config files of those tools from one settings file, \`gspot.toml\`. It runs the
tools before each commit and push, through Git hooks, and in CI. It also writes \`AGENTS.md\` and rule files that tell
coding agents how to write code that passes the checks.

- License: ${CLI_REFERENCE.package.license}.
- Languages that gspot supports: ${CONJUNCTION_FORMAT.format(LANGUAGE_CONFIGURATIONS.map(({ title }) => title))}.
  Files in other languages, such as Go, Rust, or Java, get only the checks that run on every repository, such as the
  secret scan and the spell check.
- Frameworks and tools that gspot supports:
  ${CONJUNCTION_FORMAT.format(
      CLI_REFERENCE.configurations
          .filter(({ group }) => group !== 'language' && group !== 'general')
          .map(({ title }) => title),
  )}.
- The tools that gspot runs for each language:
${LANGUAGE_CONFIGURATIONS.filter((configuration) => listPrograms(configuration).length > 0)
    .map((configuration) => `  - ${configuration.title}: ${listPrograms(configuration).join(', ')}`)
    .join('\n')}
- gspot replaces the config files of these tools with its own: ${REPLACED_TOOLS.join(', ')}. gspot does not detect or
  replace other linters and formatters, such as oxlint and oxfmt. Those keep running as before.
- \`gspot install\` downloads the tools from npm, PyPI, and GitHub releases, at the pinned versions. mise installs the
  tools that npm and PyPI do not ship, for the whole machine. \`gspot scan\` shows how many tools gspot needs and how
  much disk space they take in \`.gspot/\`.
- gspot adds these files to the repository: \`gspot.toml\`; the \`.gspot/\` folder with the tool config files, rule
  files, Git hooks, and tool versions; a few small config files that point into \`.gspot/\`, such as
  \`eslint.config.mjs\`; and a section in \`AGENTS.md\` and in \`.gitattributes\`. It adds a CI workflow only when the
  user turns CI on.
- To remove gspot, follow [Uninstall](${CLI_REFERENCE.package.homepage}/start/install/#uninstall).`;

export const AGENT_EVALUATION = `## ${EVALUATION_HEADING}

Follow these steps when the user wants to see what gspot would find before setting it up. The scan runs on a temporary
copy of the user's repository and changes no file in it.

1. Tell the user that the scan downloads linters with npm, uv, and mise, and that mise installs them for the whole
   machine. The first scan downloads every tool, so it is slower than later scans.
2. Install the dependencies of the user's project first, so that the type checks can find its types.
3. From the root folder of the user's repository, run \`${SCAN_COMMAND} --json > "\${TMPDIR:-/tmp}/gspot-scan.json"\`.
4. Read \`.totals\`, \`.categories\`, \`.filesToFormat\`, \`.notRun\`, \`.leftOut\`, and \`.cost\` with \`jq\`. Read
   \`.checks\` only to look at single findings.
5. Sort the example findings of each category into real problems, false positives, and style choices.
6. Tell the user the numbers: the findings of each kind, the files that need formatting, the number of tools, the
   megabytes, and the seconds that each tool took. Then recommend a level, as step 3 of the setup describes.`;

export const AGENT_STEPS = `## Set up gspot: steps for coding agents

Run every command from the root folder of the user's repository. gspot needs Git, Node.js ${runtimeMinimums.node} or
newer, npm ${packageManagerMinimums.npm}, pnpm ${packageManagerMinimums.pnpm}, or Bun ${packageManagerMinimums.bun} or
newer, and mise. Node.js 22 comes with an older npm, so run \`npm install --global npm@latest\` there. Without mise, the
user installs each tool that \`gspot init\` names, because a missing tool stops every commit.

Some package managers wait several days before they install a newly published package, such as pnpm 11. In that case,
let gspot's two packages, @gspothq/cli and @gspothq/eslint-plugin, install right away by adding them to
${CONJUNCTION_FORMAT.format(RELEASE_AGE_EXCLUSIONS.map(({ label, key, file }) => `${key} in ${file} for ${label}`))}.

1. Add gspot to the repository, pinned to one exact version. Use the package manager of the repository, or mise when
   the repository has no \`package.json\`:
${setup.map(({ label, add }) => `   - ${label}: \`${add}\``).join('\n')}

${setup.flatMap(({ label, prerequisites }) => prerequisites.map((command) => `   With ${label}, run \`${command}\` first, so that gspot runs on a supported Node.js version.`)).join('\n')}
   Start every gspot command after this one with ${DISJUNCTION_FORMAT.format(setup.map(({ start }) => `\`${start}\``))}.
2. Run \`gspot scan\`. It changes nothing in the repository. Show the user what it found, and what \`gspot init\` will
   do at the default level.
3. Ask the user which level they want, and wait for the answer.
   - ${CLI_REFERENCE.levelSummaries.basic} It is the default.
   - ${CLI_REFERENCE.levelSummaries.all} It also installs a few more tools.

   Suggest \`basic\` for an existing codebase, and \`all\` for a new repository or one that coding agents write. The
   level also decides which of the existing tool config files in the repository gspot replaces.
4. Run \`gspot init --level <level>\`. It deletes the tool configs that it replaces, and refuses to run until Git holds
   each one unchanged at \`HEAD\`, so ask the user to commit their work first. It prints what it will do, then writes
   \`gspot.toml\`, the generated files, and the Git hooks without asking. Then it installs the tools and turns on the
   hooks. If it names a program that it cannot install, tell the user. \`gspot doctor\` lists what is missing. CI stays
   off until the user runs \`gspot set ci.enabled true\`.
   Later, \`gspot add <configuration>\` turns on the checks of another language or framework, and
   \`gspot remove <configuration> --reason "<why>"\` turns them off.
5. Delete the old tool settings that gspot reports as conflicts: each line under \`lint commands\` in the output of
   \`gspot init\` says what to do. After you edit \`package.json\`, run the install command of the package manager and
   \`gspot install\`. Do not run \`gspot check --fix\` on the whole repository, because it rewrites many files, and each
   then fails on its old lint findings.
6. Commit the setup files with the hooks on, then fix each file as you touch it. The setup commit passes once you delete
   what \`gspot/conflicting-configs\` reports and fix or ignore the findings of the files that it stages, such as
   \`package.json\`. Fix what the hook reports, and commit again.
7. Run \`gspot check\`, and show the user the line that starts with \`Failed:\` or \`Passed:\`. Each old finding fails the
   commit that touches its file, and the first push fails until the checks that read the whole project pass, which
   \`gspot check --only push\` shows. For each of these, ask the user whether to fix it or ignore it with
   \`gspot ignore <check> --rule <rule> --paths "<path>" --reason "<why>"\`. An ignore also hides new findings of that
   rule in those paths.
8. Tell the user what gspot added, which level is set, which checks run, which findings are left, and what you ignored.

## Daily work: rules for coding agents

- Before you write code, read \`AGENTS.md\` and the rule files that it lists under \`${GSPOT_PATHS.rules}/\`.
- When \`gspot check\` reports a language or framework that gspot does not check yet, ask the user, then run the
  \`gspot add\` command that it prints, and \`gspot install\`.
- Before you finish a change, stage it and run \`gspot check --staged --only commit\`. When you commit, fix what the hook
  reports. With the hooks off, before you push, run \`gspot check --base origin/HEAD\`. If the repository has no
  \`origin/HEAD\`, name the branch to compare with: \`gspot check --base <branch>\`.
- When each check runs: \`commit\` checks run on the staged files before each commit, \`push\` checks run before each
  push, \`message\` checks run on the commit message, and \`manual\` checks run only with
  \`gspot check --only <check>\`. \`gspot check\` with no options runs the commit and push checks.
- Exit codes: \`0\` means every check that ran passed, \`1\` means findings remain, and \`2\` means a check or the
  command could not run. After \`2\`, read the message: it names the cause, such as files to stage, a base that does not
  exist, or a missing tool. For a missing tool, run \`gspot install\`, then \`gspot doctor\`.
- \`gspot explain <check, setting, or file>\` explains it and shows the commands that change it. For a lint rule, run
  \`gspot explain <check> <rule>\`. \`gspot check --fix\` runs the formatters and the other automatic fixes. Each check
  \`<configuration>/<name>\` is documented at ${CLI_REFERENCE.docs.configurations}<configuration>/#<name>.
- Fix the code first. Ask the user before you ignore a finding, remove a configuration, or raise a limit. Each of
  these needs \`--reason "<why>"\`. To ignore a finding, run \`gspot ignore <check> --reason "<why>"\`, and add
  \`--rule <rule>\` and \`--paths "<path>"\` to narrow it. A suppression comment needs a reason too, for example
  \`// eslint-disable-next-line no-console -- reason: the command prints its result\`.
- Never suppress a size or complexity limit. Split the code, or ask the user to raise the limit with
  \`gspot set limits.<name> <value> --reason "<why>"\`.
- Change settings with \`gspot add\`, \`remove\`, \`set\`, \`unset\`, \`ignore\`, and \`unignore\`. Write the other
  \`[[...]]\` records by hand, after the user agrees, then run \`gspot install\`. Do not edit files under \`.gspot/\` or
  other generated files. After you edit a package manifest or a tsconfig, run \`gspot install\`.
- In a monorepo, each \`[[scope]]\` record in \`gspot.toml\` holds the settings of one folder. Add \`--scope <path>\`
  to \`add\`, \`remove\`, \`set\`, or \`unset\` to change the settings of one folder.
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
            description: 'every setting of gspot.toml, its accepted values, and its default',
        },
        {
            label: 'JSON output',
            url: `${REFERENCE_URL}${REFERENCE_FOLDERS.jsonOutput}/`,
            description: 'the fields of gspot check --json',
        },
    ],
};
