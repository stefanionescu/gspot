import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { type Session } from '#cli/types/planning.ts';
import { type Command } from '@commander-js/extra-typings';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { formatScopeLabel } from '#cli/system/terminal.ts';
import { explainPath } from '#cli/commands/explain/path.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { readLintRules } from '#cli/configurations/lint-rules.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import { listConfigurationSettings } from '#cli/settings/known.ts';
import { listRecordFields } from '#cli/schemas/settings/gspot-toml.ts';
import { checkStageSchema } from '#cli/schemas/configurations/parts.ts';
import { quoteArgument, formatSimilarNames } from '#cli/system/text.ts';
import { type SettingDeclaration } from '#cli/types/settings/tables.ts';
import { explainCheck, explainLintRule } from '#cli/commands/explain/check.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { ESLINT_TOOL, ESLINT_RULE_NAMES_FILE } from '#cli/config/generation/eslint.ts';
import { listCheckIds, listRuleFiles, readManifests } from '#cli/configurations/manifests.ts';
import { listSettings, getSettingValue, findDeclaration, findSettingDefault } from '#cli/settings/inherit.ts';
import { type Explanation, type SettingScope, type ConfigurationExplanation } from '#cli/types/commands/explain.ts';

function formatList(label: string, items: string[]): string[] {
    return items.length === 0 ? [] : [`${label}: ${items.join(', ')}`];
}

function explainConfiguration(session: Session | undefined, configurationName: string): Explanation | undefined {
    const manifest = readManifests().get(configurationName);
    if (manifest === undefined) return undefined;
    const row: ConfigurationExplanation = {
        name: manifest.configuration.name,
        group: manifest.configuration.group,
        title: manifest.configuration.title,
        description: manifest.configuration.description,
        requires: manifest.configuration.requires,
        tools: manifest.tools.map((tool) => (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`)),
        checks: manifest.checks.map((check) => ({ check: check.name, stage: check.stage })),
        settings: listConfigurationSettings(manifest.configuration.name).map((setting) => setting.name),
        rules: (session === undefined ? [] : selectRuleFiles(session))
            .filter((file) => listRuleFiles(manifest).some((rule) => rule.path === file.path))
            .map((file) => file.path),
        alwaysSelected: manifest.configuration.always_selected,
    };
    const { detect, files } = manifest;
    const lines = [
        `${row.title} (${row.group} configuration)`,
        '',
        row.description,
        '',
        ...formatList('Detected by', [
            ...detect.extensions,
            ...detect.filenames,
            ...detect.dependencies.map((name) => `${name} in dependencies`),
            ...detect.paths,
            ...detect.project_files.map((path) => `project file ${path}`),
            ...detect.shebangs.map((name) => `shebang ${name}`),
            ...detect.runtimes.map((name) => `runtime ${name}`),
            ...detect.tags.map((tag) => `tag ${tag}`),
            ...Object.entries(detect.content).map(([path, pattern]) => `${path} matching ${pattern}`),
            ...detect.absent_dependencies.map((name) => `${name} absent from dependencies`),
        ]),
        ...formatList('Files', [...files.extensions, ...files.filenames, ...files.paths, ...files.tags]),
        ...(files.languages ? ['Files: every file a language configuration selects'] : []),
        ...(files.prettier_plugins ? ['Files: the file types of the selected Prettier plugins'] : []),
        ...(files.eslint_plugins ? ['Files: the file types of the selected ESLint plugins'] : []),
        ...formatList('Requires', row.requires),
        ...formatList('Tools it pins', row.tools),
        ...checkStageSchema.options.flatMap((stage) =>
            formatList(
                `Checks at ${stage}`,
                row.checks.filter((check) => check.stage === stage).map((check) => check.check),
            ),
        ),
        ...formatList('Settings', row.settings),
        ...formatList('Rules', row.rules),
    ];
    return { kind: 'configuration', subject: configurationName, text: `${lines.join('\n')}\n`, data: row };
}

// Describe one scope: the default, the value and where it comes from, and how to change it.
function formatSettingScope(key: string, declaration: SettingDeclaration, entry: SettingScope): string[] {
    const recordList = Object.hasOwn(listRecordFields(), key);
    const { scope, shipped, effective } = entry;
    const { value, source, reason } = effective ?? { value: undefined, source: 'unset', reason: undefined };
    const target = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
    const head = [
        '',
        `Scope: ${formatScopeLabel(scope)}`,
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
        `Current value: ${JSON.stringify(value)} (from ${source})`,
    ];
    if (recordList)
        return [...head, `Change it: write [[${key}]] records by hand in gspot.toml, then run gspot apply.`];
    return [
        ...head,
        ...(value !== undefined && isLoosening(declaration, value, shipped)
            ? [
                  'If you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.',
              ]
            : []),
        ...(reason === undefined ? [] : [`Reason on record: ${reason}`]),
        `Change it: gspot set ${quoteArgument(key)} <value>${target} [--reason "..."]`,
        `Back to the default: gspot unset ${quoteArgument(key)}${target}`,
    ];
}

function explainSetting(session: Session | undefined, key: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const { settings } = session.settingsFile;
    // A record list lives in the root table only, so only the root scope can change it.
    const recordList = Object.hasOwn(listRecordFields(), key);
    const scopes = session.scopes.flatMap((selection) => {
        const match = findDeclaration(selection.known, key);
        if (match === undefined || (recordList && selection.scope.path !== '')) return [];
        return [
            {
                scope: selection.scope.path,
                declaration: match.declaration,
                effective: getSettingValue(selection.known, settings, key, selection.scope.path),
                shipped: findSettingDefault(selection.known, settings, match, selection.scope.path)?.value,
            },
        ];
    });
    const first = scopes[0];
    if (first === undefined) return undefined;
    const lines = [
        key,
        '',
        first.declaration.summary,
        '',
        ...(first.declaration.reason_needed === undefined
            ? []
            : [`Reason: ${first.declaration.reason_needed} needs a reason`]),
        ...scopes.flatMap((entry) => formatSettingScope(key, first.declaration, entry)),
    ];
    return {
        kind: 'setting',
        subject: key,
        text: `${lines.join('\n')}\n`,
        data: {
            key,
            ...first.declaration,
            scopes: scopes.map(({ scope, shipped, effective }) => ({
                scope,
                default: shipped,
                current: effective?.value,
                source: effective?.source,
                reason: effective?.reason,
            })),
        },
    };
}

function formatUnknownSubject(session: Session | undefined, subject: string): string {
    const candidates = [
        ...listCheckIds(session === undefined ? [] : Object.values(session.settingsFile.settings.commandChecks)),
        ...readManifests().keys(),
        ...(session?.scopes.flatMap((selection) =>
            listSettings(selection.known, session.settingsFile.settings, selection.scope.path).map(
                (setting) => setting.key,
            ),
        ) ?? []),
    ];
    const similar = formatSimilarNames(subject, [...new Set(candidates)]);
    return `gspot cannot explain ${subject}. Give a check (python/ruff), a lint rule (eslint/no-var), a configuration (python), a setting (limits.file_lines), or a file (./src/app.ts).${similar}`;
}

// A check ID wins. A tracked path wins over a lint rule with the same first folder.
function explainSlashed(
    session: Session | undefined,
    subject: string,
    file: Explanation | undefined,
): Explanation | undefined {
    const check = explainCheck(session, subject);
    if (check !== undefined) return check;
    if (file !== undefined) return file;
    const slash = subject.indexOf('/');
    return explainLintRule(subject.slice(0, slash), subject.slice(slash + 1));
}

function explainNamed(session: Session | undefined, subject: string): Explanation | undefined {
    const named = explainSetting(session, subject) ?? explainConfiguration(session, subject);
    if (named !== undefined) return named;
    if (!readLintRules(ESLINT_RULE_NAMES_FILE).rules.includes(subject)) return undefined;
    return explainLintRule(ESLINT_TOOL, subject);
}

/**
 * Explain what the subject names.
 *
 * @param session the repository, or undefined outside one.
 * @param subject a check ID, a tool/rule pair, a configuration name, a setting key, or a file path.
 * @returns the explanation.
 * @throws GspotError when no subject or file matches, with the closest known names
 */
function explain(session: Session | undefined, subject: string): Explanation {
    const file = explainPath(session, subject);
    if (file !== undefined && subject.startsWith('./')) return file;
    let explanation: Explanation | undefined;
    if (subject.includes('/')) explanation = explainSlashed(session, subject, file);
    else if (subject.includes('.')) explanation = explainSetting(session, subject);
    else explanation = explainNamed(session, subject);
    if (explanation !== undefined) return explanation;
    if (file !== undefined) return file;
    throw new GspotError('arguments', formatUnknownSubject(session, subject));
}

/**
 * Register the explain command.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
function registerExplain(program: Command, onResult: CommandCompletion): void {
    program
        .command('explain')
        .argument('<subject>', COMMAND_HELP.explain.arguments['subject'])
        .summary(COMMAND_HELP.explain.summary)
        .description(COMMAND_HELP.explain.description)
        .action(async (subject) => {
            onResult(await runExplainCommand(process.cwd(), subject));
        });
}

/**
 * Run the explain command and return its output.
 *
 * @param cwd the folder where the command starts.
 * @param subject the check, rule, configuration, setting, or path to explain.
 * @returns the explanation and its command exit code.
 */
async function runExplainCommand(cwd: string, subject: string): Promise<CommandResult> {
    const root = findRoot(cwd);

    const session = findText(root, SETTINGS_FILE) === undefined ? undefined : await openSession(root);

    const result = explain(session, subject);
    return {
        text: result.text,
        json: { ...result.data, kind: result.kind, subject: result.subject },
        exitCode: 0,
    };
}

export { registerExplain };
