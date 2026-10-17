// Two ways to start with gspot: the commands for each package manager, or a prompt that sends a coding agent to the
// steps in /llms.txt. The home page and the Quickstart share these values.
export const SETUP_COMMANDS = [
    { label: 'npm', lines: ['npm i -D -E @gspothq/cli', 'npx gspot init', 'npx gspot install'] },
    { label: 'pnpm', lines: ['pnpm add -D -E @gspothq/cli', 'pnpm exec gspot init', 'pnpm exec gspot install'] },
    { label: 'Yarn', lines: ['yarn add -D -E @gspothq/cli', 'yarn exec gspot init', 'yarn exec gspot install'] },
    { label: 'Bun', lines: ['bun add -d -E @gspothq/cli', 'bunx gspot init', 'bunx gspot install'] },
    {
        label: 'mise',
        lines: [
            'mise use --pin node@24 --tool-option allow_low_downloads=true npm:@gspothq/cli',
            'mise exec -- gspot init',
            'mise exec -- gspot install',
        ],
    },
] as const;

export const AGENT_PROMPT =
    'Set up gspot in this repository. Run curl -fsSL https://generativespotting.com/llms.txt and follow its steps.';

export const LLMS_DESCRIPTION =
    'gspot installs linters and agent rules for a repository, then runs them on every commit.';

export const AGENT_STEPS = `## Steps for coding agents

Set up gspot in the repository of the user. Run each command in the root of the repository. gspot needs Git and
Node.js 24.15 or newer.

1. Add gspot, pinned to one version, with the package manager of the repository:
   - npm: \`npm i -D -E @gspothq/cli\`
   - pnpm: \`pnpm add -D -E @gspothq/cli\`
   - Yarn: \`yarn add -D -E @gspothq/cli\`
   - Bun: \`bun add -d -E @gspothq/cli\`
   - No \`package.json\`: \`mise use --pin node@24 --tool-option allow_low_downloads=true npm:@gspothq/cli\`

   Start the next commands with \`npx gspot\`, \`pnpm exec gspot\`, \`yarn exec gspot\`, \`bunx gspot\`, or
   \`mise exec -- gspot\`.
2. Run \`gspot init --dry-run\`. Show the user the plan: the configurations that gspot found, the tool files that it
   replaces, the Git hooks, and the CI workflow.
3. Ask the user two questions, and wait for the answers:
   - Is the plan right? After init, \`gspot add <configuration>\` and \`gspot remove <configuration>\` change the
     configurations.
   - Which level? \`recommended\`, the default, finds bugs, security and accessibility problems, type errors, and
     formatting. \`all\` also checks naming, wording, structure, doc comments, duplication, and complexity, and it
     installs a few more tools. Suggest \`recommended\` for an existing codebase, and \`all\` for a new repository or
     one that agents write.
4. Run \`gspot init --yes\`. For level \`all\`, run \`gspot set level all\` next, before you install.
5. Run \`gspot install\`. It installs the pinned tools and turns on the Git hooks. If it names a program that it
   cannot install, tell the user; \`gspot doctor\` lists the missing tools.
6. Run \`gspot check\`, and show the user its last line. Fix the findings in the files that you changed. Ask the user
   before you fix findings in other files, and before you add an ignore or a suppression.
   \`gspot explain <check or lint rule>\` explains a finding.
7. Read \`AGENTS.md\` and the files in \`.gspot/rules/\` before you write more code. Commit with the hooks on, and do
   not use \`git commit --no-verify\`.
8. Tell the user what gspot wrote, the level, which checks run, and which findings are left.
`;

/**
 * Page order and contents of llms-full.txt and llms-small.txt. The guides come first and the generated reference pages
 * last. llms-small.txt holds the guides only, and the reference gets its own set.
 */
export const LLMS_PAGES = {
    promote: ['start/overview', 'start/quickstart', 'start/**', 'use/**', 'configure/**', 'checks/**', 'languages/**'],
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
};
