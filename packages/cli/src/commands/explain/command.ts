// Explain a check, rule, configuration, setting, or file path.
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import { printResult } from '#cli/system/terminal.ts';
import { type Session } from '#cli/types/planning.ts';
import { openSession } from '#cli/commands/session.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { assertVersionPin } from '#cli/apply/version-pin.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { ESLINT_TOOL } from '#cli/config/generation/eslint.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { isReasonNeeded } from '#cli/settings/errors/reasons.ts';
import { unknownSettingError } from '#cli/settings/errors/keys.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { REASON_NEEDED_TEXTS } from '#cli/config/commands/explain.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { checkStageSchema } from '#cli/configurations/schema/parts.ts';
import { type SettingDeclaration } from '#cli/types/settings/tables.ts';
import { coveredInputs, configuredChecks } from '#cli/planning/checks.ts';
import { formatUnknownConfiguration } from '#cli/configurations/select.ts';
import { knownSettings, configurationSettings } from '#cli/settings/view.ts';
import { explainCheck, explainLintRule } from '#cli/commands/explain/check.ts';
import { settingValue, declarationFor, settingCandidates } from '#cli/settings/inherit.ts';
import eslintRuleNames from '../../../configurations/language/javascript/eslint-rule-names.json';
import { listCheckIds, listRuleFiles, readManifests, formatUnknownCheck } from '#cli/configurations/manifests.ts';

import {
    type Explanation,
    type SettingScope,
    type PathExplanation,
    type ConfigurationExplanation,
} from '#cli/types/commands/explain.ts';

function formatList(label: string, items: string[]): string[] {
    return items.length === 0 ? [] : [`${label}: ${items.join(', ')}`];
}

function explainConfiguration(configurationName: string, reads: ReadCache): Explanation | undefined {
    const manifest = readManifests(reads).get(configurationName);
    if (manifest === undefined) return undefined;
    const row: ConfigurationExplanation = {
        name: manifest.configuration.name,
        group: manifest.configuration.group,
        title: manifest.configuration.title,
        description: manifest.configuration.description,
        requires: manifest.configuration.requires,
        tools: manifest.tools.map((tool) => (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`)),
        checks: manifest.checks.map((check) => ({ check: check.name, stage: check.stage })),
        settings: configurationSettings(manifest.configuration.name).map((setting) => setting.name),
        rules: listRuleFiles(manifest).map((file) => file.path),
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
        ]),
        ...formatList('Files', [...files.extensions, ...files.filenames, ...files.paths]),
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

// The lines about one scope: its default, its current value and source, and how to change it.
function scopeLines(key: string, declaration: SettingDeclaration, entry: SettingScope): string[] {
    const { scope, shipped, effective } = entry;
    const { value, source, reason } = effective ?? { value: undefined, source: 'unset', reason: undefined };
    const target = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
    return [
        '',
        `Scope: ${scope === '' ? 'root' : scope}`,
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
        `Current value: ${JSON.stringify(value)} (from ${source})`,
        ...(value !== undefined && isReasonNeeded(declaration, shipped, value)
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
    const scopes = session.scopes.flatMap((selection) => {
        const match = declarationFor(selection.known, key);
        if (match === undefined) return [];
        return [
            {
                scope: selection.scope.path,
                declaration: match.declaration,
                effective: settingValue(selection.known, session.settingsFile.settings, key, selection.scope.path),
                shipped: settingCandidates(match, key)
                    .toReversed()
                    .map((candidate) => selection.known.defaults.get(candidate))
                    .find((entry) => entry !== undefined)?.value,
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
            : [`Reason: ${REASON_NEEDED_TEXTS[first.declaration.reason_needed]}`]),
        ...scopes.flatMap((entry) => scopeLines(key, first.declaration, entry)),
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

function buildUnknownSubjectDiagnostic(session: Session | undefined, subject: string, reads: ReadCache): string {
    if (subject.includes('/'))
        return formatUnknownCheck(
            subject,
            listCheckIds(session === undefined ? [] : Object.values(session.settingsFile.settings.check), reads),
        );
    if (subject.includes('.'))
        return unknownSettingError(
            knownSettings(
                session?.scopes.flatMap((scope) => scope.selected) ?? [],
                session?.settingsFile.settings.level,
                reads,
            ),
            subject,
        );
    return formatUnknownConfiguration(subject, readManifests(reads).keys().toArray());
}

// A check retains its meaning; a tracked path precedes a rule with the same first folder.
function explainSlashed(
    session: Session | undefined,
    subject: string,
    file: Explanation | undefined,
    reads: ReadCache,
): Explanation | undefined {
    const check = explainCheck(session, subject, reads);
    if (check !== undefined) return check;
    if (file !== undefined) return file;
    const slash = subject.indexOf('/');
    return explainLintRule(subject.slice(0, slash), subject.slice(slash + 1), reads);
}

function explainNamed(session: Session | undefined, subject: string, reads: ReadCache): Explanation | undefined {
    const named = explainSetting(session, subject) ?? explainConfiguration(subject, reads);
    if (named !== undefined) return named;
    if (!eslintRuleNames.rules.includes(subject)) return undefined;
    return explainLintRule(ESLINT_TOOL, subject, reads);
}

function uncheckedNote(file: TrackedFile): string | undefined {
    if (file.kind === 'binary') return 'binary: eligible for secrets and size checks';
    if (file.kind === 'generated') return 'generated: eligible for secret checks and checks for stale generated files';
    if (file.kind === 'vendored') return 'vendored: eligible for secrets, license, and security checks';
    return undefined;
}

/**
 * Explains one file.
 * @param session the session.
 * @param file the inventoried file.
 * @returns selected configurations, checks, and recorded ignores.
 */
function buildPathReport(session: Session, file: TrackedFile): PathExplanation {
    const { path } = file;
    const scope = findScope(path, session.repository.scopes);
    const selection = session.scopes.find((entry) => entry.scope.path === scope.path) as ScopeSelection;
    const configurations = selection.selected.filter(
        (manifest) =>
            listCoveredFiles(manifest.files, [file], {
                selected: selection.selected,
                scope: selection.scope.path,
                view: selection.view,
            }).length > 0,
    );
    const report: PathExplanation = {
        path,
        scope: scope.path === '' ? 'root' : scope.path,
        fileKind: file.kind,
        tags: file.tags,
        configurations: configurations.map((manifest) => manifest.configuration.name),
        checks: configuredChecks(session)
            .filter((check) => coveredInputs(session, check).some((entry) => entry.path === file.path))
            .map((check) => ({
                check: check.check.name,
                stage: check.check.stage,
                ...(check.manifest === undefined ? {} : { configuration: check.manifest.configuration.name }),
            })),
        ignores: session.settingsFile.settings.ignore
            .filter(
                (entry) => entry.paths === undefined || entry.paths.length === 0 || buildPathMatcher(entry.paths)(path),
            )
            .map((entry) => ({
                check: entry.check,
                ...(entry.rule === undefined ? {} : { rule: entry.rule }),
                reason: entry.reason,
            })),
    };
    if (file.kindSource !== undefined) report.fileKindSource = file.kindSource;
    const unchecked = uncheckedNote(file);
    if (unchecked !== undefined) report.unchecked = unchecked;
    if (report.checks.length === 0 && file.kind === 'source') {
        report.unchecked = 'no selected check reads this file';
        report.remedy =
            'Mark generated or copied files linguist-generated or linguist-vendored in .gitattributes, or run gspot add <configuration>.';
    }
    return report;
}

/**
 * The report as text.
 * @param report the report.
 * @returns the text for stdout.
 */
function formatPathReport(report: PathExplanation): string {
    const by = report.fileKindSource === undefined ? '' : ` by ${report.fileKindSource}`;
    const checks = report.checks.map(
        (check) => `  ${check.check}  ${check.stage}  (${check.configuration ?? 'repository command'})`,
    );
    const ignores = report.ignores.map((entry) => {
        const rule = entry.rule === undefined ? '' : ` ${entry.rule}`;
        const reason = entry.reason === undefined ? '' : `  ${entry.reason}`;
        return `  ${entry.check}${rule}${reason}`;
    });
    const lines = [
        `${report.path}  (scope ${report.scope}, ${report.fileKind}${by})`,
        '',
        ...(report.unchecked === undefined ? [] : [report.unchecked]),
        ...(report.configurations.length === 0 ? [] : [`checked by: ${report.configurations.join(', ')}`]),
        ...(checks.length === 0 ? [] : ['checks:', ...checks]),
        ...(ignores.length === 0 ? [] : ['ignores:', ...ignores]),
        ...(report.remedy === undefined ? [] : ['', `to change this: ${report.remedy}`]),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Explains whatever the argument names, or returns the near matches.
 * @param session the session, or undefined outside a repository.
 * @param subject a check ID, a tool/rule pair, a configuration name, a setting key, or a file path.
 * @param reads the cache shared by every lookup in this explanation.
 * @returns the requested explanation
 * @throws GspotError when no subject or file matches, with the closest known names
 */
function explain(session: Session | undefined, subject: string, reads: ReadCache): Explanation {
    const file = explainPath(session, subject);
    if (file !== undefined && subject.startsWith('./')) return file;
    let explanation: Explanation | undefined;
    if (subject.includes('/')) explanation = explainSlashed(session, subject, file, reads);
    else if (subject.includes('.')) explanation = explainSetting(session, subject);
    else explanation = explainNamed(session, subject, reads);
    if (explanation !== undefined) return explanation;
    if (file !== undefined) return file;
    throw new GspotError('arguments', buildUnknownSubjectDiagnostic(session, subject, reads));
}

/**
 * Register the explain command.
 * @param program the command program
 */
function registerExplain(program: Command): void {
    program
        .command('explain')
        .argument('<subject>', COMMAND_HELP.explain.arguments['subject'])
        .summary(COMMAND_HELP.explain.summary)
        .description(COMMAND_HELP.explain.description)
        .action(async (subject) => {
            const root = findRoot(process.cwd());
            await assertVersionPin(root);
            const session = readText(root, SETTINGS_FILE) === undefined ? undefined : await openSession(root);
            const result = explain(session, subject, session?.reads ?? createReadCache(root));
            printResult({
                text: result.text,
                json: { ...result.data, kind: result.kind, subject: result.subject },
                exitCode: 0,
            });
        });
}

/**
 * Explains a repository file or an explicitly requested path.
 * @param session the repository session, or undefined outside a configured repository.
 * @param subject the file path or another explanation subject.
 * @returns the file explanation, or undefined for another subject.
 * @throws GspotError when an explicitly requested path does not exist.
 */
function explainPath(session: Session | undefined, subject: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const path = subject.startsWith('./') ? subject.slice('./'.length) : subject;
    const file = session.repository.files.find((entry) => entry.path === path);
    if (file === undefined) {
        if (subject.startsWith('./')) throw new GspotError('arguments', `${path} is not a file in this repository.`);
        return undefined;
    }
    const report = buildPathReport(session, file);
    return { kind: 'path', subject: path, text: formatPathReport(report), data: report };
}

export { explain, registerExplain };
