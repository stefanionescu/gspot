import { SIDEBAR } from './navigation.ts';
import { SITE_URL, DOCS_PATH } from './site.ts';
import { LOCKFILES } from '#cli/config/files/lockfiles.ts';
import { START_RUNNERS } from '#cli/config/repository/npm.ts';
import cliPackage from '@gspothq/cli/package.json' with { type: 'json' };
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { SKILLS_FOLDER, SKILLS_INDEX_FILE, MARKDOWN_COPY_FILE } from './agents.ts';
import { FROZEN_INSTALLS, YARN_BERRY_INSTALL } from '#cli/config/generation/ci.ts';
import { LEVEL_SUMMARY, ALL_LEVEL_SUMMARY } from '#cli/config/settings/definitions/root.ts';
import { REFERENCE_PATH, REFERENCE_FOLDERS, DISJUNCTION_FORMAT, CONJUNCTION_FORMAT } from './reference.ts';

const PACKAGE_MANAGERS = { bun: 'Bun', npm: 'npm', pnpm: 'pnpm', yarn: 'Yarn', mise: 'mise' } as const;

export const SETUP_COMMANDS = Object.entries(PACKAGE_MANAGERS).map(([name, label]) => {
    const { command, installCommand } = START_RUNNERS[name as keyof typeof START_RUNNERS];
    const lockfile = LOCKFILES.find((file) => file.packageManager === name && 'copied' in file)?.file;
    const frozen =
        name === 'yarn' ? YARN_BERRY_INSTALL : lockfile && FROZEN_INSTALLS[lockfile as keyof typeof FROZEN_INSTALLS];
    return {
        label,
        start: command,
        lines: [
            installCommand.replace('<package>@<version>', () => cliPackage.name),
            `${command} init`,
            `${command} install`,
        ] as const,
        clone: [...(frozen === undefined ? [] : [frozen.join(' ')]), `${command} install`, `${command} check`],
    };
});

export const YARN_CLASSIC_INSTALL = FROZEN_INSTALLS['yarn.lock'].join(' ');

export const LOCKFILE_INSTALLS = [
    { lockfile: 'yarn.lock', note: 'Yarn 2 on', command: YARN_BERRY_INSTALL.join(' ') },
    ...Object.entries(FROZEN_INSTALLS).map(([lockfile, command]) => ({
        lockfile,
        note: lockfile === 'yarn.lock' ? 'Yarn 1' : undefined,
        command: command.join(' '),
    })),
];

const RANGE_OPERATOR = /^[<>=^~]+/u;

export const RUNTIME_MINIMUMS = {
    node: cliPackage.engines.node.replace(RANGE_OPERATOR, ''),
    bun: cliPackage.engines.bun.replace(RANGE_OPERATOR, ''),
} as const;

export const PLUGIN_REQUIREMENTS = {
    node: pluginPackage.engines.node.replace(RANGE_OPERATOR, ''),
    eslint: pluginPackage.peerDependencies.eslint.replace(RANGE_OPERATOR, ''),
    typescriptEslint: pluginPackage.peerDependencies['@typescript-eslint/eslint-plugin'].replace(RANGE_OPERATOR, ''),
} as const;

export const RELEASE_AGE_EXCLUSIONS = [
    { label: 'pnpm', key: 'minimumReleaseAgeExclude', file: 'pnpm-workspace.yaml' },
    { label: 'Bun', key: 'install.minimumReleaseAgeExcludes', file: 'bunfig.toml' },
    { label: 'npm', key: 'min-release-age-exclude', file: '.npmrc' },
    { label: 'Yarn', key: 'npmPreapprovedPackages', file: '.yarnrc.yml' },
] as const;

const REFERENCE_URL = `${SITE_URL}${REFERENCE_PATH}`;

export const LLMS_URL = `${SITE_URL}/llms.txt`;

export const CURL_COMMAND = 'curl -fsSL';

export const LLMS_COMMAND = `${CURL_COMMAND} ${LLMS_URL}`;

export const AGENT_PROMPT = `Set up gspot in a repository. Run ${LLMS_COMMAND} and follow its steps.`;

export const AGENT_STEPS = `## Steps for coding agents

Set up gspot in the repository of the user. Run each command at the root of the repository. gspot needs Git and
Node.js ${RUNTIME_MINIMUMS.node} or newer, and Bun ${RUNTIME_MINIMUMS.bun} or newer when Bun runs it. A package manager that holds new
releases, such as pnpm 11, needs @gspothq/cli and @gspothq/eslint-plugin in its exclusions: ${CONJUNCTION_FORMAT.format(
    RELEASE_AGE_EXCLUSIONS.map(({ label, key }) => `${key} for ${label}`),
)}.

1. Add gspot, pinned to one version, with the package manager of the repository, or with mise when the repository
   has no \`package.json\`:
${SETUP_COMMANDS.map(({ label, lines }) => `   - ${label}: \`${lines[0]}\``).join('\n')}

   Start the next commands with ${DISJUNCTION_FORMAT.format(SETUP_COMMANDS.map(({ start }) => `\`${start}\``))}.
2. Ask the user which level, and wait for the answer. ${LEVEL_SUMMARY} ${ALL_LEVEL_SUMMARY} Level \`all\` also
   installs a few more tools. Suggest \`basic\`, the default, for an existing codebase, and \`all\` for a new
   repository or one that agents write. The level decides which config files the plan replaces.
3. Run \`gspot init --dry-run --level <level>\`. Show the user the plan: the configurations, the scopes, the tool
   files that gspot replaces, the Git hooks, and the CI workflow. Ask whether the plan is right, and wait for the
   answer. After init, \`gspot add <configuration>\` and \`gspot remove <configuration> --reason "<why>"\` change it.
4. Run \`gspot init --yes --level <level>\`.
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
  ${REFERENCE_URL}${REFERENCE_FOLDERS.checks}/<check>/.
- Fix the code first. Ask the user before you ignore a finding, remove a configuration, or raise a limit; each takes
  \`--reason "<why>"\`. To ignore a finding:
  \`gspot ignore <check> --reason "<why>"\`, with \`--rule <rule>\` and \`--paths "<glob>"\` to narrow it.
  A suppression comment needs a reason, such as
  \`// eslint-disable-next-line no-console -- reason: the command prints its result\`.
- Never suppress a size or complexity limit. Split the code, or ask the user to raise the limit with
  \`gspot set limits.<name> <value> --reason "<why>"\`.
- Change settings only with \`gspot add\`, \`remove\`, \`set\`, \`unset\`, \`ignore\`, and \`unignore\`. Do not edit files
  under \`.gspot/\` or other generated files. After you edit \`gspot.toml\` by hand, run \`gspot apply\`.
- In a monorepo, each \`[[scope]]\` record in \`gspot.toml\` holds the settings of one folder. Add \`--scope <path>\` to
  \`add\`, \`remove\`, \`set\`, or \`unset\` to change one scope.
- Commit with the hooks on. Never use \`--no-verify\`.
`;

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
    customSelectors: { all: ['.sl-anchor-link'] },
    optionalLinks: [
        {
            label: 'Commands',
            url: `${REFERENCE_URL}${REFERENCE_FOLDERS.commands}/`,
            description: 'every command, its options, and exit codes',
        },
        {
            label: 'Settings',
            url: `${REFERENCE_URL}${REFERENCE_FOLDERS.settings}/`,
            description: 'every key of gspot.toml, its accepted values, and its default',
        },
        {
            label: 'JSON output',
            url: `${REFERENCE_URL}${REFERENCE_FOLDERS.jsonOutput}/`,
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
