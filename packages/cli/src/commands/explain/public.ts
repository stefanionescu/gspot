// Explain a check, rule, configuration, setting, or file path.
import { hasPolicy } from '#cli/policy/public.ts';
import { GspotError } from '#cli/platform/public.ts';
import { printResult } from '#cli/terminal/public.ts';
import type { Session } from '#cli/types/planning.ts';
import { quoteArgument } from '#cli/platform/contracts.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { knownSettings } from '#cli/policy/settings/public.ts';
import { ownersOf } from '#cli/repository/selection/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { checkStageSchema } from '#cli/parsers/schema/command.ts';
import { findRoot } from '#cli/repository/discovery/contracts.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { readEslintRuleNames } from '#cli/generation/eslint/public.ts';
import type { SettingDeclaration } from '#cli/types/configurations.ts';
import { ownedInputs, configuredChecks } from '#cli/planning/public.ts';
import { unknownSettingDiagnostic } from '#cli/policy/errors/public.ts';
import { commandHelp, commandRoot, openSession } from '#cli/commands/public.ts';
import { settingValue, declarationFor } from '#cli/policy/settings/contracts.ts';
import { explainCheck, explainToolRule } from '#cli/commands/explain/contracts.ts';
import { DIRECTION_TEXTS, REASON_DIRECTIONS } from '#cli/config/commands/explain.ts';
import { knownChecks, configurationFiles, configurationManifests } from '#cli/configurations/public.ts';
import { unknownCheckDiagnostic, unknownConfigurationDiagnostic } from '#cli/configurations/errors/public.ts';

import type {
    Explanation,
    SettingScope,
    PathExplanation,
    ConfigurationExplanation,
} from '#cli/types/commands/explain.ts';

function formatList(label: string, items: string[]): string[] {
    return items.length === 0 ? [] : [`${label}: ${items.join(', ')}`];
}

function explainConfiguration(configurationName: string): Explanation | undefined {
    const manifest = configurationManifests().get(configurationName);
    if (manifest === undefined) return undefined;
    const row: ConfigurationExplanation = {
        name: manifest.configuration.name,
        kind: manifest.configuration.kind,
        title: manifest.configuration.title,
        description: manifest.configuration.description,
        requires: manifest.configuration.requires,
        tools: manifest.tools.map((tool) => (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`)),
        checks: manifest.checks.map((check) => ({ check: check.name, stage: check.stage })),
        settings: manifest.settings.map((setting) => setting.name),
        agentRules: configurationFiles(manifest).map((file) => file.path),
        auto: manifest.configuration.always_selected,
    };
    const { detect, files } = manifest;
    const lines = [
        `${row.title} (${row.kind} configuration)`,
        '',
        row.description,
        '',
        ...formatList('Detected by', [
            ...detect.extensions,
            ...detect.filenames,
            ...detect.dependencies.map((name) => `${name} in dependencies`),
        ]),
        ...formatList('Files', [...files.extensions, ...files.filenames, ...files.paths]),
        ...(files.languages ? ['Files: every file a language configuration owns'] : []),
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
        ...formatList('Agent rules', row.agentRules),
    ];
    return { kind: 'configuration', subject: configurationName, text: `${lines.join('\n')}\n`, data: row };
}

// The lines about one scope: its default, its current value and source, and how to change it.
function scopeLines(key: string, declaration: SettingDeclaration, entry: SettingScope): string[] {
    const { scope, shipped, effective } = entry;
    const { value, source = 'unset', reason } = effective === undefined ? {} : effective;
    const target = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
    const requiresReason = REASON_DIRECTIONS.includes(declaration.direction);
    return [
        '',
        `Scope: ${scope === '' ? 'root' : scope}`,
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
        `Current value: ${JSON.stringify(value)} (from ${source})`,
        ...(reason === undefined ? [] : [`Reason on record: ${reason}`]),
        `Change it: gspot set ${quoteArgument(key)} <value>${target}${requiresReason ? ' --reason "..."' : ''}`,
        `Back to the default: gspot set ${quoteArgument(key)} --default${target}`,
    ];
}

function explainSetting(session: ToolSession | undefined, key: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const scopes = session.scopes.flatMap((selection) => {
        const match = declarationFor(selection.surface, key);
        if (match === undefined) return [];
        return [
            {
                scope: selection.scope.path,
                declaration: match.declaration,
                effective: settingValue(selection.surface, session.policyFiles.policy, key, selection.scope.path),
                shipped: selection.surface.defaults.get(match.declaration.name)?.value,
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
        ...(first.declaration.direction === undefined
            ? []
            : [`Direction: ${DIRECTION_TEXTS[first.declaration.direction]}`]),
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

function buildUnknownSubjectDiagnostic(session: ToolSession | undefined, subject: string): string {
    if (subject.includes('/'))
        return unknownCheckDiagnostic(
            subject,
            knownChecks(session === undefined ? [] : Object.values(session.policyFiles.policy.check)),
        );
    if (subject.includes('.'))
        return unknownSettingDiagnostic(
            knownSettings(session?.scopes.flatMap((scope) => scope.selected) ?? [], session?.policyFiles.policy.level),
            subject,
        );
    return unknownConfigurationDiagnostic(subject, configurationManifests().keys().toArray());
}

// A check retains its meaning; a tracked path precedes a rule with the same first folder.
function explainSlashed(
    session: ToolSession | undefined,
    subject: string,
    file: Explanation | undefined,
): Explanation | undefined {
    const check = explainCheck(session, subject);
    if (check !== undefined) return check;
    if (file !== undefined) return file;
    const slash = subject.indexOf('/');
    return explainToolRule(subject.slice(0, slash), subject.slice(slash + 1));
}

function explainNamed(session: ToolSession | undefined, subject: string): Explanation | undefined {
    const named = explainSetting(session, subject) ?? explainConfiguration(subject);
    if (named !== undefined) return named;
    if (!readEslintRuleNames().rules.includes(subject)) return undefined;
    return explainToolRule('eslint', subject);
}

function uncheckedNote(file: TrackedFile): string | undefined {
    if (file.kind === 'binary') return 'binary: eligible for secrets and size checks';
    if (file.kind === 'generated') {
        const by = file.producedBy === undefined ? '' : ` by ${file.producedBy}`;
        return `generated${by}: eligible for secrets and freshness checks`;
    }
    if (file.kind === 'vendored') return 'vendored: eligible for secrets, license, and security checks';
    return undefined;
}

/**
 * Explains one file.
 * @param session the session.
 * @param file the inventoried file.
 * @returns file ownership, enabled checks, and recorded ignores.
 */
function buildPathReport(session: Session, file: TrackedFile): PathExplanation {
    const { path } = file;
    const scope = scopeOf(path, session.repository.scopes);
    const selection = session.scopes.find((entry) => entry.scope.path === scope.path) ?? session.scopes[0];
    const owners = selection ? ownersOf(file, selection.selected, selection.scope.path, selection.view.test_files) : [];
    const report: PathExplanation = {
        path,
        scope: scope.path === '' ? 'root' : scope.path,
        fileKind: file.kind,
        tags: file.tags,
        configurations: owners.map((manifest) => manifest.configuration.name),
        checks: configuredChecks(session)
            .filter((check) => ownedInputs(session, check).some((entry) => entry.path === file.path))
            .map((check) => ({
                check: check.check.name,
                stage: check.check.stage,
                ...(check.manifest === undefined ? {} : { configuration: check.manifest.configuration.name }),
            })),
        ignores: session.policyFiles.policy.ignore
            .filter((entry) => entry.paths === undefined || entry.paths.length === 0 || pathMatcher(entry.paths)(path))
            .map((entry) => ({
                check: entry.check,
                ...(entry.rule === undefined ? {} : { rule: entry.rule }),
                ...(entry.reason === undefined ? {} : { reason: entry.reason }),
            })),
    };
    if (file.kindSource !== undefined) report.fileKindSource = file.kindSource;
    const unchecked = uncheckedNote(file);
    if (unchecked !== undefined) report.unchecked = unchecked;
    if (report.checks.length === 0 && file.kind === 'source') {
        report.unchecked = 'no enabled check owns this file';
        report.remedy = 'gspot set generated "<glob>" or gspot set vendored "<glob>", or gspot add <configuration>';
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
        ...(report.configurations.length === 0 ? [] : [`owned by: ${report.configurations.join(', ')}`]),
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
 * @returns the requested explanation
 * @throws GspotError when no subject or file matches, with the closest known names
 */
export function explain(session: ToolSession | undefined, subject: string): Explanation {
    const file = explainPath(session, subject);
    if (file !== undefined && subject.startsWith('./')) return file;
    let explanation: Explanation | undefined;
    if (subject.includes('/')) explanation = explainSlashed(session, subject, file);
    else if (subject.includes('.')) explanation = explainSetting(session, subject);
    else explanation = explainNamed(session, subject);
    if (explanation !== undefined) return explanation;
    if (file !== undefined) return file;
    throw new GspotError('selection', buildUnknownSubjectDiagnostic(session, subject));
}

/**
 * Registers explain.
 * @param program the commander program
 */
export function registerExplain(program: Program): void {
    program
        .command('explain')
        .argument('<subject>', 'Check ID, rule, configuration, setting, or file path')
        .summary('Explain a check, rule, configuration, setting, or file')
        .description(
            'Explain a check, a rule, a configuration, a setting, or a file path: what it is and what to do about it. A rule also gets the gspot ignore and gspot set lines that change it. A setting gets its value, its default, and where the value comes from. A file gets the checks that read it. explain changes nothing.',
        )
        .addHelpText('after', commandHelp('explain'))
        .action(async (subject, _flags, command) => {
            const root = findRoot(commandRoot(command));
            const session = hasPolicy(root) ? await openSession(root) : undefined;
            const result = explain(session, subject);
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
 * @throws GspotError when an explicitly requested path is absent.
 */
export function explainPath(session: Session | undefined, subject: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const path = subject.startsWith('./') ? subject.slice('./'.length) : subject;
    const file = session.repository.files.find((entry) => entry.path === path);
    if (file === undefined) {
        if (subject.startsWith('./'))
            throw new GspotError('selection', `${path} is not a file git tracks or would track here.`);
        return undefined;
    }
    const report = buildPathReport(session, file);
    return { kind: 'path', subject: path, text: formatPathReport(report), data: report };
}
