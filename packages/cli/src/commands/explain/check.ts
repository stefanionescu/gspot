import { findCheck } from '#cli/manifests/checks.ts';
import { CODE_MARK } from '#cli/config/commands/help.ts';
import { describeCheck } from '#cli/engine/reference.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { Session, ScopeCheck } from '#cli/types/tools.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { isConfigurationSelected } from '#cli/settings/scopes.ts';
import { selectRuleFiles } from '#cli/generation/builders/rules.ts';
import type { Check, Configuration } from '#cli/types/manifests.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { formatArgumentSelector } from '#cli/settings/values/paths.ts';
import { quoteCommand, quoteArgument } from '#cli/system/text/quoting.ts';
import type { CheckIgnore, Explanation, CheckExplanation } from '#cli/types/commands.ts';
import { REPOSITORY_COMMAND, RUN_IN_COPY_MESSAGE, SELECTED_YES_MESSAGE } from '#cli/config/commands/lookup.ts';

function listCheckIgnores(session: Session | undefined, checkId: string, cwd: string): CheckIgnore[] {
    if (session === undefined) return [];
    return session.settings.ignore
        .filter((ignore) => ignore.check === checkId)
        .map(({ rule, paths, reason }) => ({
            rule,
            paths,
            reason,
            command: [
                `gspot unignore ${quoteArgument(checkId)}`,
                ...(rule === undefined ? [] : [`--rule ${quoteArgument(rule)}`]),
                ...(paths ?? []).flatMap((path) => [
                    '--paths',
                    quoteArgument(formatArgumentSelector(session.root, cwd, path)),
                ]),
            ].join(' '),
        }));
}

function formatCheckIgnore(ignore: CheckIgnore): string {
    const paths = ignore.paths === undefined ? 'everywhere' : `in ${ignore.paths.join(', ')}`;
    const target = ignore.rule === undefined ? paths : `rule ${ignore.rule} ${paths}`;
    return `  ${target}: ${ignore.reason}  (undo: ${ignore.command})`;
}

function formatRepositoryUse(facts: CheckExplanation): string[] {
    const lines: string[] = [];
    if (facts.command !== null)
        lines.push(`Command: ${quoteCommand(facts.command)}`, `Paths: ${(facts.paths ?? []).join(', ')}`);
    if (facts.selected !== null)
        lines.push(
            facts.selected
                ? SELECTED_YES_MESSAGE
                : `Selected in this repository: no (gspot add ${String(facts.configuration)})`,
        );
    if (facts.ignores.length > 0)
        lines.push('Ignored in this repository:', ...facts.ignores.map((ignore) => formatCheckIgnore(ignore)));
    return lines;
}

function formatCheckExplanation(facts: CheckExplanation): string {
    const { settingNames: settings, ruleFiles, minVersions } = facts;
    const source = facts.configuration === null ? REPOSITORY_COMMAND : `${facts.configuration} configuration`;
    const lines = [
        `${facts.check}  (${source}, ${facts.stage} stage, ${facts.level} level)`,
        '',
        `What it looks for: ${facts.summary.replaceAll(CODE_MARK, '')}`,
        `Why it matters: ${facts.why.replaceAll(CODE_MARK, '')}`,
        `What to do: ${facts.help.replaceAll(CODE_MARK, '')}`,
        ...(facts.condition?.setting === undefined ? [] : [`Required setting: ${facts.condition.setting}`]),
        ...Object.entries(minVersions).map(([name, version]) => `Needs ${name} ${version} or newer.`),
        '',
        'Ignore it only with a reason your team accepts.',
        ...[
            { label: 'Ignore it for some paths', command: facts.turnOff.paths },
            { label: 'Ignore one of its lint rules', command: facts.turnOff.rule },
        ].flatMap(({ label, command }) => (command === null ? [] : [`${label}: ${command}`])),
        ...(facts.runInCopy === true ? [RUN_IN_COPY_MESSAGE] : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(ruleFiles.length === 0 ? [] : [`Rule files that state it: ${ruleFiles.join(', ')}`]),
        ...formatRepositoryUse(facts),
    ];
    return `${lines.join('\n')}\n`;
}

function buildCheckOrigin(
    check: Check,
    configuration: Configuration | undefined,
): Pick<CheckExplanation, 'configuration' | 'command' | 'paths'> {
    if (configuration !== undefined) return { configuration: configuration.name, command: null, paths: null };
    const paths = check.files?.paths ?? null;
    return { configuration: null, command: check.command ?? null, paths };
}

function listToolSettings(configuration: Configuration | undefined, toolName: string | undefined): string[] {
    if (configuration === undefined || toolName === undefined) return [];
    return (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? [])
        .filter((setting) => setting.name.startsWith(`tools.${toolName}.`))
        .map((setting) => setting.name);
}

function listInstalledRuleFiles(check: Check, session: Session | undefined): string[] {
    if (check.rules === undefined || session === undefined) return [];
    const installedRules = new Set(selectRuleFiles(session).map((file) => file.path));
    return check.rules.filter((path) => installedRules.has(path));
}

function buildCheckExplanation(
    found: Pick<ScopeCheck, 'check' | 'configuration'>,
    session: Session | undefined,
    cwd: string,
): CheckExplanation {
    const { check, configuration } = found;
    const { toolName, crashPattern, minVersions, turnOff } = describeCheck(
        check,
        readConfigurations().values().toArray(),
        selectCheckCode(check)?.explanations,
    );
    const selected =
        session === undefined || configuration === undefined
            ? null
            : isConfigurationSelected(session.scopes, configuration.name);
    return {
        check: check.id,
        ...buildCheckOrigin(check, configuration),
        stage: check.stage,
        level: check.level,
        summary: check.summary,
        why: check.why,
        help: check.help,
        condition: check.when ?? null,
        crashPattern: crashPattern ?? null,
        runInCopy: check.run_in_copy ?? null,
        minVersions,
        turnOff: { ...turnOff, rule: turnOff.rule ?? null },
        settingNames: listToolSettings(configuration, toolName),
        ruleFiles: listInstalledRuleFiles(check, session),
        selected,
        ignores: listCheckIgnores(session, check.id, cwd),
    };
}

export function explainCheck(session: Session | undefined, checkId: string, cwd: string): Explanation | undefined {
    const found = findCheck(checkId, session?.settings.commandChecks);
    if (found === undefined) return undefined;
    const facts = buildCheckExplanation(found, session, cwd);
    return { kind: 'check', subject: checkId, text: formatCheckExplanation(facts), facts };
}
