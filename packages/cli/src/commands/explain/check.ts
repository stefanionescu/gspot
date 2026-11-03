import { GspotError } from '#cli/system/errors.ts';
import { CODE_MARK } from '#cli/config/commands/help.ts';
import { describeCheck } from '#cli/engine/reference.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { getTool, findToolName } from '#cli/tools/pins.ts';
import { LIMIT_SETTING_RULES } from '#cli/manifests/limits.ts';
import type { Session, ScopeCheck } from '#cli/types/tools.ts';
import { OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';
import { readCheckRuleDocs } from '#cli/configurations/rules.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { quoteCommand, quoteArgument } from '#cli/system/text.ts';
import { SETTING_RULES } from '#cli/config/settings/validation.ts';
import { isConfigurationSelected } from '#cli/manifests/select.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import type { Check, Configuration, ConfigurationCheck } from '#cli/types/manifests.ts';
import { listRuleFiles, listChecksById, readConfigurations } from '#cli/manifests/read.ts';

import {
    LINT_RULE_LABELS,
    REPOSITORY_COMMAND,
    RUN_IN_COPY_MESSAGE,
    SELECTED_YES_MESSAGE,
} from '#cli/config/commands/reports.ts';
import type {
    CheckFacts,
    CheckIgnore,
    Explanation,
    CheckExplanation,
    LintRuleExplanation,
} from '#cli/types/commands/reports.ts';

function listCheckIgnores(session: Session | undefined, checkId: string): CheckIgnore[] {
    return (session?.settings.ignore ?? [])
        .filter((ignore) => ignore.check === checkId)
        .map(({ rule, paths, reason }) => ({
            rule,
            paths,
            reason,
            command: [
                `gspot unignore ${quoteArgument(checkId)}`,
                ...(rule === undefined ? [] : [`--rule ${quoteArgument(rule)}`]),
                ...(paths === undefined ? [] : paths.flatMap((path) => ['--paths', quoteArgument(path)])),
            ].join(' '),
        }));
}

function buildCheckFacts(
    check: Check,
    configuration: Configuration | undefined,
    configurationsByName: ReadonlyMap<string, Configuration>,
    session: Session | undefined,
): CheckFacts {
    const reference = describeCheck(check, configurationsByName.values().toArray());
    const toolName = reference.toolName;
    const installedRules = new Set(session === undefined ? [] : selectRuleFiles(session).map((file) => file.path));
    const settings = (configuration === undefined ? [] : (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []))
        .filter((setting) => toolName !== undefined && setting.name.startsWith(`tools.${toolName}.`))
        .map((setting) => setting.name);
    const ruleFiles =
        configuration === undefined
            ? []
            : listRuleFiles(configuration)
                  .filter((file) => installedRules.has(file.path))
                  .map((file) => file.path);
    const crashPattern =
        toolName === undefined ? undefined : getTool(configurationsByName.values(), toolName).crash_pattern;
    return {
        settings,
        ruleFiles,
        crashPattern,
        ignores: listCheckIgnores(session, check.id),
        minVersions: reference.minVersions,
        turnOff: reference.turnOff,
    };
}

function formatCheckIgnore(ignore: CheckIgnore): string {
    const paths = ignore.paths === undefined ? 'everywhere' : `in ${ignore.paths.join(', ')}`;
    const target = ignore.rule === undefined ? paths : `rule ${ignore.rule} ${paths}`;
    return `  ${target}: ${ignore.reason}  (undo: ${ignore.command})`;
}

function formatRepositoryUse(facts: CheckExplanation): string[] {
    const lines: string[] = [];
    if (facts.command !== undefined)
        lines.push(`Command: ${quoteCommand(facts.command)}`, `Paths: ${(facts.paths ?? []).join(', ')}`);
    if (facts.selected !== undefined)
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
    const { settings, ruleFiles, minVersions } = facts;
    const source = facts.configuration === undefined ? REPOSITORY_COMMAND : `${facts.configuration} configuration`;
    const lines = [
        `${facts.check}  (${source}, ${facts.stage} stage, ${facts.level} level)`,
        '',
        `What it looks for: ${facts.summary.replaceAll(CODE_MARK, '')}`,
        `Why it matters: ${facts.why.replaceAll(CODE_MARK, '')}`,
        `What to do: ${facts.help.replaceAll(CODE_MARK, '')}`,
        ...(facts.condition?.setting === undefined ? [] : [`Required setting: ${facts.condition.setting}`]),
        ...Object.entries(minVersions).map(([name, version]) => `Needs ${name} ${version} or newer.`),
        '',
        'Ask the user before you ignore a check.',
        `Ignore it for some paths: ${facts.turnOff.paths}`,
        ...(facts.turnOff.rule === undefined ? [] : [`Ignore one of its lint rules: ${facts.turnOff.rule}`]),
        ...(facts.runInCopy === true ? [RUN_IN_COPY_MESSAGE] : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(ruleFiles.length === 0 ? [] : [`Rule files that state it: ${ruleFiles.join(', ')}`]),
        ...formatRepositoryUse(facts),
    ];
    return `${lines.join('\n')}\n`;
}

function formatBuiltinRuleIgnore(check: Check): string | undefined {
    const ruleDocs = selectCheckCode(check)?.ruleDocs;
    if (ruleDocs === undefined) return undefined;
    const rule = Object.keys(ruleDocs).at(0);
    return rule === undefined
        ? undefined
        : `gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(rule)} --reason "<why>"`;
}

function formatRuleOptions(
    tool: string | undefined,
    identifier: string,
    configuration: Configuration,
): string | undefined {
    if (tool === undefined) return undefined;
    const owner = { ...LIMIT_SETTING_RULES[tool], ...SETTING_RULES[tool] }[identifier];
    if (owner !== undefined) return `gspot set ${owner} <value>`;
    const key = `tools.${tool}.rules`;
    const settings = SETTINGS_BY_CONFIGURATION.get(configuration.name);
    if (settings?.some((setting) => setting.name === key) !== true) return undefined;
    const ruleExample = quoteArgument(`{ ${JSON.stringify(identifier)} = [<options>] }`);
    return `gspot set ${quoteArgument(key)} ${ruleExample}`;
}

function formatLintRuleLines(facts: LintRuleExplanation): string[] {
    const { tool, rule, page } = facts;
    const pageLines = page === null ? [] : [`The tool's page: ${page}`];
    if (page === null && tool !== undefined) pageLines.push(`Read the ${tool} documentation for ${rule}.`);
    const docs = { ...facts, description: facts.description ?? undefined };
    return [
        `${facts.check} ${rule}`,
        '',
        ...LINT_RULE_LABELS.flatMap(([key, label]) => (docs[key] === undefined ? [] : [`${label}: ${docs[key]}`])),
        ...(facts.explanation === undefined ? [] : ['', facts.explanation]),
        ...pageLines,
        '',
        'Ask the user before you ignore a rule (SUPPRESSIONS.md).',
        `Ignore it everywhere: ${facts.turnOff.everywhere}`,
        `Ignore it for some paths: ${facts.turnOff.paths}`,
        ...(facts.changeOptions === undefined ? [] : [`Change its options: ${facts.changeOptions}`]),
    ];
}

function findRuleCheck(checkId: string): ConfigurationCheck | undefined {
    const found = listChecksById(readConfigurations().values()).get(checkId);
    if (
        found !== undefined &&
        !OUTPUT_FORMATS[found.check.output.format].namesRules(found.check.output) &&
        selectCheckCode(found.check)?.ruleDocs === undefined
    )
        throw new GspotError(
            'arguments',
            `gspot cannot explain one lint rule of ${checkId}. Leave out the rule to explain the whole check.`,
        );
    return found;
}

function buildCheckExplanation(
    found: Pick<ScopeCheck, 'check' | 'configuration'>,
    configurationsByName: ReadonlyMap<string, Configuration>,
    session: Session | undefined,
): CheckExplanation {
    const { check, configuration } = found;
    const described = buildCheckFacts(check, configuration, configurationsByName, session);
    const selected =
        session === undefined || configuration === undefined
            ? undefined
            : isConfigurationSelected(session.scopes, configuration.name);
    return {
        check: check.id,
        ...(configuration === undefined
            ? { command: check.command, paths: check.files?.paths }
            : { configuration: configuration.name }),
        stage: check.stage,
        level: check.level,
        summary: check.summary,
        why: check.why,
        help: check.help,
        condition: check.when,
        crashPattern: described.crashPattern,
        runInCopy: check.run_in_copy,
        minVersions: described.minVersions,
        turnOff: { ...described.turnOff, rule: described.turnOff.rule ?? formatBuiltinRuleIgnore(check) },
        settings: described.settings,
        ruleFiles: described.ruleFiles,
        ...(selected !== undefined && { selected }),
        ignores: described.ignores,
    };
}

/**
Explain a shipped check or a command check.

@param session the repository, or undefined outside one.
@param checkId the check ID to explain.
@returns undefined when no check has the ID.
*/
export function explainCheck(session: Session | undefined, checkId: string): Explanation | undefined {
    const configurationsByName = readConfigurations();
    const commandCheck = session?.settings.commandChecks[checkId];
    const found: Pick<ScopeCheck, 'check' | 'configuration'> | undefined =
        listChecksById(configurationsByName.values()).get(checkId) ??
        (commandCheck === undefined ? undefined : { check: commandCheck, configuration: undefined });
    if (found === undefined) return undefined;
    const facts = buildCheckExplanation(found, configurationsByName, session);
    return { kind: 'check', subject: checkId, text: formatCheckExplanation(facts), facts };
}

/**
Explain one lint rule: its page, its description from the installed tool, and how to ignore it or change its
options. ESLint and Stylelint rules must exist in the tools that gspot installed.

@param root the repository root, whose tool project holds ESLint and Stylelint.
@param checkId the check that runs the rule.
@param identifier the rule ID, including its plugin prefix.
@param options the detail level and tool time limit.
@param options.verbose whether to include the full explanation.
@param options.session the repository settings and tool project, when available.
@returns undefined when no check runs the tool, or when ESLint or Stylelint has no such rule.
@throws GspotError when gspot cannot name one lint rule of the check.
*/
export async function explainLintRule(
    root: string,
    checkId: string,
    identifier: string,
    { verbose, session }: { verbose?: boolean; session?: Session } = {},
): Promise<Explanation | undefined> {
    const found = findRuleCheck(checkId);
    if (found === undefined) return undefined;
    const tool = OUTPUT_FORMATS[found.check.output.format].namesRules(found.check.output)
        ? findToolName(found.check)
        : undefined;
    const docs = await readCheckRuleDocs(root, found.check, identifier, session);
    if (docs === undefined) return undefined;
    const ignore = `gspot ignore ${quoteArgument(found.check.id)} --rule ${quoteArgument(identifier)}`;
    const facts: LintRuleExplanation = {
        tool,
        rule: identifier,
        check: found.check.id,
        page: docs.url ?? null,
        description: docs.description ?? null,
        why: docs.why,
        fix: docs.fix,
        example: docs.example,
        explanation: verbose === true ? docs.explanation : undefined,
        turnOff: {
            everywhere: `${ignore} --reason "<why>"`,
            paths: `${ignore} --paths "<path>" --reason "<why>"`,
        },
        changeOptions: formatRuleOptions(tool, identifier, found.configuration),
    };
    return {
        kind: 'lint-rule',
        subject: `${checkId} ${identifier}`,
        text: `${formatLintRuleLines(facts).join('\n')}\n`,
        facts,
    };
}
