import { SITE_TITLE } from '#docs/config/site.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { DOCS_PATHS, CLI_REFERENCE, formatNameList } from '@gspothq/cli/reference';
import { CURL_COMMAND, LEVEL_SUGGESTION, EVALUATION_HEADING, RELEASE_AGE_EXCLUSIONS } from '#docs/config/reference.ts';

const { homepage } = cliPackage;

export const LLMS_URL = `${homepage}/llms.txt`;

export const LLMS_COMMAND = `${CURL_COMMAND} ${LLMS_URL}`;

const SCAN_COMMAND = `npx --yes ${cliPackage.name}@${cliPackage.version} scan`;

export const AGENT_PROMPT = `Set up gspot in my repository. Run ${LLMS_COMMAND} and follow its steps.`;

export const EVALUATION_PROMPT = `Show me what gspot would find in my repository. Run \`${LLMS_COMMAND}\`, follow "${EVALUATION_HEADING}", and change nothing until I answer.`;

const LANGUAGE_CONFIGURATIONS = CLI_REFERENCE.configurations.filter(({ group }) => group === 'language');

function listPrograms(configuration: (typeof CLI_REFERENCE.configurations)[number]): string[] {
    return configuration.tools.filter(({ kind }) => kind === 'program').map(({ name }) => name);
}

const OVERVIEW = `# ${SITE_TITLE}

${cliPackage.description}

gspot sets up linters, formatters, and type checkers for the languages and frameworks in a repository, and pins each
tool that it installs. It writes the config files of those tools from one settings file, \`gspot.toml\`, and runs the
tools before each commit and push, through Git hooks, and in CI. It also writes \`AGENTS.md\` and rule files that tell
coding agents how to write code that passes the checks.

These steps cover ${cliPackage.name} ${cliPackage.version}. gspot needs Git, Node.js ${CLI_REFERENCE.runtimeMinimums.node} or newer,
npm ${CLI_REFERENCE.packageManagerMinimums.npm}, pnpm ${CLI_REFERENCE.packageManagerMinimums.pnpm}, or Bun ${CLI_REFERENCE.packageManagerMinimums.bun} or newer, and mise. Node.js 22 comes with an older npm,
so run \`npm install --global npm@latest\` there.`;

const SUPPORT = `## Supported languages and frameworks

- Languages: ${formatNameList(LANGUAGE_CONFIGURATIONS.map(({ title }) => title))}. Files in other
  languages, such as Go, Rust, or Java, get only the checks that run on every repository, such as the secret scan and
  the spell check.
- Frameworks and tools: ${formatNameList(
    CLI_REFERENCE.configurations
        .filter(({ group }) => group !== 'language' && group !== 'general')
        .map(({ title }) => title),
)}.
- The tools that gspot runs for each language:
${LANGUAGE_CONFIGURATIONS.filter((configuration) => listPrograms(configuration).length > 0)
    .map((configuration) => `  - ${configuration.title}: ${listPrograms(configuration).join(', ')}`)
    .join('\n')}
- gspot does not detect or replace other linters and formatters, such as oxlint and oxfmt. Those keep running as before.`;

const EVALUATION = `## ${EVALUATION_HEADING}

Follow these steps when the user wants to see what gspot finds before setting it up. The scan runs on a temporary
copy of the user's repository and changes no file in it.

1. Tell the user that the scan downloads linters with npm, uv, and mise, and that mise installs them for the whole
   machine. The first scan downloads every tool, so it is slower than later scans.
2. Tell the user that the scan reads only the files in the Git index: the committed files and the staged changes. It
   leaves out untracked files and unstaged edits, and it needs a Git repository.
3. Install the dependencies of the user's project first, so that the type checks can find its types.
4. From the root folder of the user's repository, run \`${SCAN_COMMAND} --json > "\${TMPDIR:-/tmp}/gspot-scan.json"\`.
5. Read \`.totals\`, \`.categories\`, \`.filesToFormat\`, \`.notRun\`, \`.leftOut\`, \`.cost\`, and \`.plan.deleted\` with
   \`jq\`. \`.plan.deleted\` lists the tool configs that \`gspot init\` deletes. Read \`.checks\` only to look at single
   findings.
6. Sort the example findings of each category into real problems, false positives, and style choices.
7. Tell the user the numbers: the findings of each kind, the files that need formatting, the number of tools, the
   megabytes, and the seconds that each tool took. Name the tool configs that \`gspot init\` deletes.
   Then recommend ${LEVEL_SUGGESTION}.`;

const SETUP = `## Set up gspot

Run every command from the root folder of the user's repository. Without mise, the user installs each tool that
\`gspot init\` names, because a missing tool stops every commit. A \`packageManager\` field in \`package.json\` needs
mise, because gspot runs that version through it.

Some package managers refuse a version until it is a set age, as pnpm 11 does for one day by default. In that case,
let gspot's two packages, @gspothq/cli and @gspothq/eslint-plugin, install right away by adding them to
${formatNameList(RELEASE_AGE_EXCLUSIONS.map(({ label, key, file }) => `${key} in ${file} for ${label}`))}.

1. Add gspot to the repository, pinned to one exact version. Use the package manager of the repository, or mise when
   the repository has no \`package.json\`:
${CLI_REFERENCE.setup.map(({ label, add }) => `   - ${label}: \`${add}\``).join('\n')}

${CLI_REFERENCE.setup.flatMap(({ label, prerequisites }) => prerequisites.map((command) => `   With ${label}, run \`${command}\` first, so that gspot runs on a supported Node.js version.`)).join('\n')}
   Start every gspot command after this one with ${formatNameList(
       CLI_REFERENCE.setup.map(({ start }) => `\`${start}\``),
       'disjunction',
   )}.
2. Skip this step when you followed "${EVALUATION_HEADING}". Otherwise run \`gspot scan\`. It changes nothing in the
   repository. Show the user what it found, and what \`gspot init\` will do at the default level.
3. Ask the user which level they want, and wait for the answer.
   - ${CLI_REFERENCE.levelSummaries.basic} It is the default.
   - ${CLI_REFERENCE.levelSummaries.all} It also installs a few more tools.

   Suggest ${LEVEL_SUGGESTION}.
   The level also decides which of the existing tool config files in the repository gspot replaces.
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
8. Tell the user what gspot added, which level is set, which checks run, which findings are left, and what you ignored.`;

const DOCUMENTATION = `## Documentation

- [Troubleshooting](${homepage}/use/troubleshooting/)
- [Commands](${DOCS_PATHS.commands})
- [gspot.toml settings](${DOCS_PATHS.settings})
- [JSON output](${DOCS_PATHS.jsonOutput})
- [Uninstall](${homepage}/start/install/#uninstall)`;

export const LLMS_TEXT = `${[OVERVIEW, SUPPORT, EVALUATION, SETUP, DOCUMENTATION].join('\n\n')}\n`;
