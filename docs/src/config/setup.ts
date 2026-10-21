import { SIDEBAR } from './navigation.ts';
import { SITE_URL, DOCS_PATH } from './site.ts';
import { REFERENCE_PATH, REFERENCE_FOLDERS } from './reference.ts';
import cliPackage from '@gspothq/cli/package.json' with { type: 'json' };
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { SKILLS_FOLDER, SKILLS_INDEX_FILE, MARKDOWN_COPY_FILE } from './agents.ts';

// Two ways to start with gspot: the commands for each package manager, or a prompt that sends a coding agent to the
// steps in /llms.txt. The home page and the Quickstart share these values.
export const SETUP_COMMANDS = [
    { label: 'npm', start: 'npx gspot', lines: ['npm i -D -E @gspothq/cli', 'npx gspot init', 'npx gspot install'] },
    {
        label: 'pnpm',
        start: 'pnpm exec gspot',
        lines: ['pnpm add -D -E @gspothq/cli', 'pnpm exec gspot init', 'pnpm exec gspot install'],
    },
    {
        label: 'Yarn',
        start: 'yarn exec gspot',
        lines: ['yarn add -D -E @gspothq/cli', 'yarn exec gspot init', 'yarn exec gspot install'],
    },
    {
        label: 'Bun',
        start: 'bunx gspot',
        lines: ['bun add -d -E @gspothq/cli', 'bunx gspot init', 'bunx gspot install'],
    },
    {
        label: 'mise',
        start: 'mise exec -- gspot',
        lines: [
            'mise use --pin node@24 --tool-option allow_low_downloads=true npm:@gspothq/cli',
            'mise exec -- gspot init',
            'mise exec -- gspot install',
        ],
    },
] as const;

/** The comparison operators in front of a version in a package range, such as `>=` in `>=24.15.0`. */
const RANGE_OPERATOR = /^[<>=^~]+/u;

/** The oldest runtimes that run gspot, from the engines of the CLI package. */
export const RUNTIME_MINIMUMS = {
    node: cliPackage.engines.node.replace(RANGE_OPERATOR, ''),
    bun: cliPackage.engines.bun.replace(RANGE_OPERATOR, ''),
} as const;

/** The versions that the ESLint plugin needs. Its engines and peer dependencies give them. */
export const PLUGIN_REQUIREMENTS = {
    node: pluginPackage.engines.node.replace(RANGE_OPERATOR, ''),
    eslint: pluginPackage.peerDependencies.eslint.replace(RANGE_OPERATOR, ''),
    typescriptEslint: pluginPackage.peerDependencies['@typescript-eslint/eslint-plugin'].replace(RANGE_OPERATOR, ''),
    typescript: pluginPackage.peerDependencies.typescript.split(' ').map((bound) => bound.replace(RANGE_OPERATOR, '')),
} as const;

/** The package managers that hold back new releases, and the setting that exempts the gspot packages. */
export const RELEASE_AGE_EXCLUSIONS = [
    { label: 'pnpm', key: 'minimumReleaseAgeExclude', file: 'pnpm-workspace.yaml' },
    { label: 'Bun', key: 'install.minimumReleaseAgeExcludes', file: 'bunfig.toml' },
    { label: 'npm', key: 'min-release-age-exclude', file: '.npmrc' },
    { label: 'Yarn', key: 'npmPreapprovedPackages', file: '.yarnrc.yml' },
] as const;

/** The llms.txt address, and the command that prints it. */
export const LLMS_URL = `${SITE_URL}/llms.txt`;
export const LLMS_COMMAND = `curl -fsSL ${LLMS_URL}`;

export const AGENT_PROMPT = `Set up gspot in a repository. Run ${LLMS_COMMAND} and follow its steps.`;

export const AGENT_STEPS = `## Steps for coding agents

Set up gspot in the repository of the user. Run each command at the root of the repository. gspot needs Git and
Node.js ${RUNTIME_MINIMUMS.node} or newer, or Bun ${RUNTIME_MINIMUMS.bun} or newer when Bun runs it. A package manager that holds new
releases, such as pnpm 11, needs @gspothq/cli and @gspothq/eslint-plugin in its exclusions: ${new Intl.ListFormat(
    'en',
    { type: 'conjunction' },
).format(RELEASE_AGE_EXCLUSIONS.map(({ label, key }) => `${key} for ${label}`))}.

1. Add gspot, pinned to one version, with the package manager of the repository, or with mise when the repository
   has no \`package.json\`:
${SETUP_COMMANDS.map(({ label, lines }) => `   - ${label}: \`${lines[0]}\``).join('\n')}

   Start the next commands with ${new Intl.ListFormat('en', { type: 'disjunction' }).format(
       SETUP_COMMANDS.map(({ start }) => `\`${start}\``),
   )}.
2. Run \`gspot init --dry-run\`. Show the user the plan: the configurations, the scopes, the tool files that gspot
   replaces, the Git hooks, and the CI workflow.
3. Ask the user two questions, and wait for the answers:
   - Is the plan right? After init, \`gspot add <configuration>\` and \`gspot remove <configuration>\` change it.
   - Which level? \`recommended\`, the default, finds bugs, security and accessibility problems, type errors, and
     formatting. \`all\` also checks naming, wording, structure, doc comments, duplication, and complexity, and it
     installs a few more tools. Suggest \`recommended\` for an existing codebase, and \`all\` for a new repository or
     one that agents write.
4. Run \`gspot init --yes\`. For level \`all\`, run \`gspot set level all\` next.
5. Run \`gspot install\`. It installs the pinned tools and turns on the Git hooks. If it names a program that it
   cannot install, tell the user. \`gspot doctor\` lists what is missing.
6. Run \`gspot check\`, and show the user its last line. Fix the findings in the files that you changed. Ask the user
   before you fix findings in other files.
7. Tell the user what gspot wrote, the level, which checks run, and which findings are left.

## Rules for daily work

- Read \`AGENTS.md\` and the rules it lists under \`.gspot/configurations/\` before you write code.
- Stages: \`commit\` checks run on the staged files before each commit, \`push\` checks before each push, \`message\`
  checks on the commit message, and \`manual\` checks only with \`gspot check --only <check>\`. \`gspot check\` alone
  runs the commit and push checks.
- Exit codes: \`0\` every check that ran passed, \`1\` findings remain, \`2\` a check could not run. After \`2\`, run
  \`gspot install\`, then \`gspot doctor\`.
- \`gspot explain <check, lint rule, setting, or file>\` explains it and names the commands that change it.
  \`gspot check --fix\` runs the formatters and other fixers. Each check has a page at
  ${SITE_URL}/reference/checks/<check>/.
- Fix the code first. Ask the user before you ignore a finding:
  \`gspot ignore <check> --reason "<why>"\`, with \`--rule <rule>\` and \`--paths "<glob>"\` to narrow it.
  A suppression comment needs a reason, such as
  \`// eslint-disable-next-line no-console -- the command prints its result\`.
- Never suppress a size or complexity limit. Split the code, or ask the user to raise the limit with
  \`gspot set limits.<name> <value> --reason "<why>"\`.
- Change settings only with \`gspot add\`, \`remove\`, \`set\`, \`unset\`, \`ignore\`, and \`unignore\`. Do not edit files
  under \`.gspot/\` or other generated files. After you edit \`gspot.toml\` by hand, run \`gspot apply\`.
- In a monorepo, each \`[[scope]]\` record in \`gspot.toml\` holds the settings of one folder. Add \`--scope <path>\` to
  \`add\`, \`remove\`, \`set\`, or \`unset\` to change one scope.
- Commit with the hooks on. Never use \`--no-verify\`.
`;

/**
 * Page order and contents of llms-full.txt and llms-small.txt. The guides come first and the generated reference pages
 * last. llms-small.txt holds the guides only, and the reference gets its own set.
 */
export const LLMS_PAGES = {
    promote: SIDEBAR.flatMap(({ items }) => items.map(({ slug }) => slug.replace(/\/index$/u, ''))),
    demote: ['404', 'reference/**'],
    exclude: ['404', 'reference/**'],
    customSets: [
        {
            label: 'Reference',
            paths: ['reference/**'],
            description: 'every command, gspot.toml setting, configuration, check, and ESLint plugin rule',
        },
    ],
    // The hidden "Section titled" link text of each heading.
    customSelectors: { all: ['.sl-anchor-link'] },
    optionalLinks: [
        {
            label: 'Commands',
            url: `${SITE_URL}${REFERENCE_PATH}${REFERENCE_FOLDERS.commands}/`,
            description: 'every command, its options, and exit codes',
        },
        {
            label: 'Settings',
            url: `${SITE_URL}${REFERENCE_PATH}${REFERENCE_FOLDERS.settings}/`,
            description: 'every key of gspot.toml, its accepted values, and its default',
        },
        {
            label: 'JSON output',
            url: `${SITE_URL}${REFERENCE_PATH}${REFERENCE_FOLDERS.jsonOutput}/`,
            description: 'the fields of gspot check --json',
        },
        {
            label: 'Markdown pages',
            url: `${SITE_URL}${DOCS_PATH}${MARKDOWN_COPY_FILE}`,
            description: 'add index.md to the address of any page for its Markdown copy',
        },
        {
            label: 'Agent Skill',
            url: `${SITE_URL}/${SKILLS_FOLDER}${SKILLS_INDEX_FILE}`,
            description: 'the steps above as an Agent Skill',
        },
    ],
};
