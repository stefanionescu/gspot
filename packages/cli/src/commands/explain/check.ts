import { CODE_MARK } from '#cli/config/commands/help.ts';
import { describeCheck } from '#cli/engine/reference.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { getTool, findToolName } from '#cli/tools/pins.ts';
import type { CommandCheck } from '#cli/types/settings.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { hasRuleOutput } from '#cli/engine/outputs/formats.ts';
import { readCheckRuleDocs } from '#cli/configurations/rules.ts';
import type { Session, LintRuleDocs } from '#cli/types/tools.ts';
import { quoteCommand, quoteArgument } from '#cli/system/text.ts';
import { isConfigurationSelected } from '#cli/manifests/select.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import type { Check, ScopeCheck, Configuration } from '#cli/types/manifests.ts';
import { listRuleFiles, listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import type { CheckFacts, CheckIgnore, Explanation } from '#cli/types/commands/reports.ts';

import {
    LINT_RULE_LABELS,
    REPOSITORY_COMMAND,
    RUN_IN_COPY_MESSAGE,
    SELECTED_YES_MESSAGE,
} from '#cli/config/commands/reports.ts';

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
    configuration: ScopeCheck['configuration'],
    configurationsByName: Map<string, Configuration>,
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
        source: configuration === undefined ? REPOSITORY_COMMAND : `${configuration.name} configuration`,
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

function formatRepositoryUse(
    session: Session | undefined,
    commandCheck: CommandCheck | undefined,
    configuration: ScopeCheck['configuration'],
): string[] {
    const lines: string[] = [];
    if (commandCheck !== undefined)
        lines.push(`Command: ${quoteCommand(commandCheck.command)}`, `Paths: ${commandCheck.files.paths.join(', ')}`);
    if (session && configuration !== undefined)
        lines.push(
            isConfigurationSelected(session.scopes, configuration.name)
                ? SELECTED_YES_MESSAGE
                : `Selected in this repository: no (gspot add ${configuration.name})`,
        );
    return lines;
}

function formatCheckExplanation(
    session: Session | undefined,
    found: ScopeCheck,
    commandCheck: CommandCheck | undefined,
    facts: CheckFacts,
): string {
    const { check, configuration } = found;
    const { source, settings, ruleFiles, minVersions } = facts;
    const lines = [
        `${check.id}  (${source}, ${check.stage} stage, ${check.level} level)`,
        '',
        `What it looks for: ${check.summary.replaceAll(CODE_MARK, '')}`,
        `Why it matters: ${check.why.replaceAll(CODE_MARK, '')}`,
        `What to do: ${check.help.replaceAll(CODE_MARK, '')}`,
        ...(check.when?.setting === undefined ? [] : [`Required setting: ${check.when.setting}`]),
        ...Object.entries(minVersions).map(([name, version]) => `Needs ${name} ${version} or newer`),
        '',
        `Turn it off for some paths: ${facts.turnOff.paths}`,
        ...(facts.turnOff.rule === undefined ? [] : [`Turn one of its lint rules off: ${facts.turnOff.rule}`]),
        ...(check.run_in_copy === true ? [RUN_IN_COPY_MESSAGE] : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(ruleFiles.length === 0 ? [] : [`Rule files that state it: ${ruleFiles.join(', ')}`]),
        ...formatRepositoryUse(session, commandCheck, configuration),
        ...(facts.ignores.length === 0 ? [] : ['Ignored in this repository:']),
        ...facts.ignores.map((ignore) => formatCheckIgnore(ignore)),
    ];
    return `${lines.join('\n')}\n`;
}

function formatBuiltinRuleIgnore(checkId: string): string | undefined {
    const ruleDocs = CHECK_CODE[checkId]?.ruleDocs;
    if (ruleDocs === undefined) return undefined;
    const rule = Object.keys(ruleDocs).at(0);
    if (rule === undefined) return undefined;
    return `gspot ignore ${quoteArgument(checkId)} --rule ${quoteArgument(rule)} --reason "<why>"`;
}

function formatRuleOptions(tool: string | undefined, identifier: string, configuration: Configuration): string[] {
    if (tool === undefined) return [];
    const key = `tools.${tool}.rules`;
    const settings = SETTINGS_BY_CONFIGURATION.get(configuration.name);
    if (settings?.some((setting) => setting.name === key) !== true) return [];
    const ruleExample = quoteArgument(`{ ${JSON.stringify(identifier)} = [<options>] }`);
    return [`Change its options: gspot set ${quoteArgument(key)} ${ruleExample}`];
}

function formatLintRuleLines(
    found: { check: Check; configuration: Configuration },
    rule: {
        tool: string | undefined;
        identifier: string;
        page: string | undefined;
        docs: LintRuleDocs;
        verbose: boolean;
    },
): string[] {
    const { check, configuration } = found;
    const { tool, identifier, page, docs } = rule;
    const optionLines = formatRuleOptions(tool, identifier, configuration);
    const pageLines = page === undefined ? [] : [`The tool's page: ${page}`];
    if (page === undefined && tool !== undefined) pageLines.push(`Read the ${tool} documentation for ${identifier}.`);
    return [
        `${check.id} ${identifier}`,
        '',
        ...LINT_RULE_LABELS.flatMap(([key, label]) => (docs[key] === undefined ? [] : [`${label}: ${docs[key]}`])),
        ...(rule.verbose && docs.explanation !== undefined ? ['', docs.explanation] : []),
        ...pageLines,
        '',
        'Ask the user before you turn a rule off (SUPPRESSIONS.md).',
        `Turn it off everywhere: gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(identifier)} --reason "<why>"`,
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(identifier)} --paths "<path>" --reason "<why>"`,
        ...optionLines,
    ];
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
    const found: ScopeCheck | undefined =
        listChecksById(configurationsByName.values()).get(checkId) ??
        (commandCheck === undefined ? undefined : { check: commandCheck, configuration: undefined });
    if (found === undefined) return undefined;
    const { check, configuration } = found;
    const facts = buildCheckFacts(check, configuration, configurationsByName, session);
    facts.turnOff.rule ??= formatBuiltinRuleIgnore(checkId);
    return {
        kind: 'check',
        subject: checkId,
        text: formatCheckExplanation(session, found, commandCheck, facts),
        facts: {
            check: checkId,
            ...(configuration === undefined
                ? { command: check.command, paths: check.files?.paths }
                : { configuration: configuration.name }),
            stage: check.stage,
            level: check.level,
            summary: check.summary,
            why: check.why,
            help: check.help,
            condition: check.when,
            crashPattern: facts.crashPattern,
            runInCopy: check.run_in_copy,
            settings: facts.settings,
            ruleFiles: facts.ruleFiles,
            ignores: facts.ignores,
        },
    };
}

/**
Explain one lint rule: its page, its description from the installed tool, and how to turn it off or change its
options. ESLint and Stylelint rules must exist in the tools that gspot installed.

@param root the repository root, whose tool project holds ESLint and Stylelint.
@param checkId the check that runs the rule.
@param identifier the rule ID, including its plugin prefix.
@param options the detail level and tool time limit.
@param options.verbose whether to include the full explanation.
@param options.session the repository settings and tool project, when available.
@returns undefined when no check runs the tool, or when ESLint or Stylelint has no such rule.
*/
export async function explainLintRule(
    root: string,
    checkId: string,
    identifier: string,
    { verbose, session }: { verbose?: boolean; session?: Session } = {},
): Promise<Explanation | undefined> {
    const configurationsByName = readConfigurations();
    const found = listChecksById(configurationsByName.values()).get(checkId);
    if (found === undefined) return undefined;
    const tool = hasRuleOutput(found.check) ? findToolName(found.check) : undefined;
    const docs = await readCheckRuleDocs(root, found.check, identifier, session);
    if (docs === undefined) return undefined;
    const page = docs.url;
    const lines = formatLintRuleLines(found, { tool, identifier, page, docs, verbose: verbose === true });
    return {
        kind: 'lint-rule',
        subject: `${checkId} ${identifier}`,
        text: `${lines.join('\n')}\n`,
        facts: {
            tool,
            rule: identifier,
            check: found.check.id,
            page: page ?? null,
            description: docs.description ?? null,
            why: docs.why,
            fix: docs.fix,
            example: docs.example,
            explanation: verbose === true ? docs.explanation : undefined,
        },
    };
}
