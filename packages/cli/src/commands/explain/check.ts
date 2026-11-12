import { CODE_MARK } from '#cli/config/commands/help.ts';
import {
    LINT_RULE_LABELS,
    REPOSITORY_COMMAND,
    RUN_IN_COPY_MESSAGE,
    SELECTED_YES_MESSAGE,
} from '#cli/config/commands/reports.ts';
import { WEAKENINGS_CHECK } from '#cli/config/settings/validation.ts';
import { readListedRuleExplanation } from '#cli/configurations/lint-rules.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { describeCheck } from '#cli/engine/reference.ts';
import { buildUnknownRuleError, canIgnoreRule, findRuleTool, hasRuleExplanations } from '#cli/engine/results.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { findCheck, listRuleFiles, readConfigurations } from '#cli/manifests/read.ts';
import { isConfigurationSelected } from '#cli/manifests/select.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { formatArgumentSelector } from '#cli/settings/paths.ts';
import { findRuleSetting } from '#cli/settings/validation/keys.ts';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument, quoteCommand } from '#cli/system/text.ts';
import type { CheckExplanation, CheckIgnore, Explanation, LintRuleExplanation } from '#cli/types/commands.ts';
import type { Check, Configuration } from '#cli/types/manifests.ts';
import type { RuleExplanation, ScopeCheck, Session } from '#cli/types/tools.ts';

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

function formatRuleOptions(
    { check, configuration }: { check: Check; configuration: Configuration | undefined },
    tool: string | undefined,
    identifier: string,
): string | undefined {
    if (tool === undefined || configuration === undefined) return undefined;
    if (!hasRuleExplanations(check, selectCheckCode(check), identifier)) return undefined;
    const owner = findRuleSetting(tool, identifier);
    if (owner !== undefined) return `gspot set ${owner} <value>`;
    const key = `tools.${tool}.rules`;
    const setting = SETTINGS_BY_CONFIGURATION.get(configuration.name)?.find(({ name }) => name === key);
    if (setting?.type !== 'table') return undefined;
    const ruleExample = quoteArgument(`{ ${JSON.stringify(identifier)} = [<options>] }`);
    return `gspot set ${quoteArgument(key)} ${ruleExample}`;
}

function formatLintRuleLines(facts: LintRuleExplanation): string[] {
    const { tool, rule, page } = facts;
    const pageLines = page === null ? [] : [`The tool's page: ${page}`];
    if (page === null && tool !== null) pageLines.push(`Read the ${tool} documentation for ${rule}.`);
    return [
        `${facts.check} ${rule}`,
        '',
        ...LINT_RULE_LABELS.flatMap(([key, label]) => (facts[key] === null ? [] : [`${label}: ${facts[key]}`])),
        ...(facts.explanation === null ? [] : ['', facts.explanation]),
        ...pageLines,
        '',
        'Ignore it only with a reason your team accepts.',
        `Ignore it everywhere: ${facts.turnOff.everywhere}`,
        ...(facts.turnOff.paths === null ? [] : [`Ignore it for some paths: ${facts.turnOff.paths}`]),
        ...(facts.changeOptions === null ? [] : [`Change its options: ${facts.changeOptions}`]),
    ];
}

function buildRuleDocFacts(
    docs: RuleExplanation,
    { verbose }: { verbose: boolean | undefined },
): Pick<LintRuleExplanation, 'page' | 'description' | 'why' | 'fix' | 'example' | 'explanation'> {
    const { url, description, why, fix, example } = docs;
    const explanation = verbose === true ? (docs.explanation ?? null) : null;
    return {
        page: url ?? null,
        description: description ?? null,
        why: why ?? null,
        fix: fix ?? null,
        example: example ?? null,
        explanation,
    };
}

function findRuleCheck(
    checkId: string,
    session: Session | undefined,
): { check: Check; configuration: Configuration | undefined } | undefined {
    const found = findCheck(checkId, session?.settings.commandChecks);
    if (found !== undefined && !canIgnoreRule(found.check, selectCheckCode(found.check)))
        throw new GspotError(
            'arguments',
            `gspot cannot explain one lint rule of ${checkId}. Leave out the rule to explain the whole check.`,
        );
    return found;
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

function listInstalledRuleFiles(configuration: Configuration | undefined, session: Session | undefined): string[] {
    if (configuration === undefined || session === undefined) return [];
    const installedRules = new Set(selectRuleFiles(session).map((file) => file.path));
    return listRuleFiles(configuration)
        .filter((file) => installedRules.has(file.path))
        .map((file) => file.path);
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
        ruleFiles: listInstalledRuleFiles(configuration, session),
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

/**
Explain one lint rule: its page, its description from the installed tool, and how to ignore it or change its
options. A rule of a command check gets the help of its check and the command that ignores it.

@param options.session the repository settings and tool project, when available.
@returns the explanation. A name outside the rules that gspot reads gets the help of its check.
@throws GspotError when gspot cannot name one lint rule of the check, when no shipped check and no command check has
this name, or when the check lists its rules and this is not one.
*/
export async function explainLintRule(
    root: string,
    checkId: string,
    identifier: string,
    { verbose, session }: { verbose?: boolean; session?: Session },
): Promise<Explanation> {
    const found = findRuleCheck(checkId, session);
    if (found === undefined) throw buildUnknownRuleError(identifier, checkId);
    const tool = findRuleTool(found.check);
    const docs = (await readListedRuleExplanation(root, found.check, identifier, session)) ?? { fix: found.check.help };
    const ignore = `gspot ignore ${quoteArgument(found.check.id)} --rule ${quoteArgument(identifier)}`;
    const facts: LintRuleExplanation = {
        tool: tool ?? null,
        rule: identifier,
        check: found.check.id,
        ...buildRuleDocFacts(docs, { verbose }),
        turnOff: {
            everywhere: `${ignore} --reason "<why>"`,
            paths: found.check.id === WEAKENINGS_CHECK ? null : `${ignore} --paths "<path>" --reason "<why>"`,
        },
        changeOptions: formatRuleOptions(found, tool, identifier) ?? null,
    };
    return {
        kind: 'lint-rule',
        subject: `${checkId} ${identifier}`,
        text: `${formatLintRuleLines(facts).join('\n')}\n`,
        facts,
    };
}
