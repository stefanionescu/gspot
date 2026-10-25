import type { Session } from '#cli/types/session.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { RULE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import type { CommandCheck } from '#cli/types/settings/file.ts';
import { quoteCommand, quoteArgument } from '#cli/system/text.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/configurations/names.ts';
import type { CheckFacts, Explanation } from '#cli/types/commands/explain.ts';
import { getTool, getToolName, extractRulePrefix } from '#cli/configurations/tools.ts';
import { listRuleFiles, listChecksById, readConfigurations } from '#cli/configurations/manifests.ts';
import { type Tool, type Check, type ScopeCheck, type Configuration } from '#cli/types/configurations.ts';

function findRulePlugin(prefix: string, configurations: Map<string, Configuration>): Tool | undefined {
    return configurations
        .values()
        .flatMap((configuration) => configuration.tools)
        .find((pin) => pin.rule_prefix === prefix);
}

function findRulePage(tool: string, rule: string, configurations: Map<string, Configuration>): string | undefined {
    const prefix = extractRulePrefix(rule);
    if (prefix === undefined) {
        const pin = getTool(configurations.values(), tool);
        return pin.rule_url?.replace(RULE_PLACEHOLDER, () => rule);
    }
    const plugin = findRulePlugin(prefix, configurations);
    return plugin?.rule_url?.replace(RULE_PLACEHOLDER, () => rule.slice(prefix.length + 1));
}

function buildCheckFacts(
    check: Check,
    configuration: ScopeCheck['configuration'],
    configurations: Map<string, Configuration>,
    installedRules: ReadonlySet<string>,
): CheckFacts {
    const toolName = getToolName(check);
    const settings = (configuration === undefined ? [] : (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []))
        .filter((setting) => toolName !== undefined && setting.name.startsWith(`tools.${toolName}.`))
        .map((setting) => setting.name);
    const rules =
        configuration === undefined
            ? []
            : listRuleFiles(configuration)
                  .filter((file) => installedRules.has(file.path))
                  .map((file) => file.path);
    const crashPattern = toolName === undefined ? undefined : getTool(configurations.values(), toolName).crash_pattern;
    return {
        source: configuration === undefined ? 'repository command' : `${configuration.name} configuration`,
        settings,
        rules,
        crashPattern,
        minVersions: Object.fromEntries(
            [toolName, ...(check.other_tools ?? [])]
                .filter((name) => name !== undefined)
                .map((name) => getTool(configurations.values(), name))
                .flatMap((tool) => (tool.min_version === undefined ? [] : [[tool.name, tool.min_version]])),
        ),
    };
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
                ? 'Selected in this repository: yes'
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
    const { source, settings, rules, minVersions } = facts;
    const lines = [
        `${check.id}  (${source}, ${check.stage} stage, ${check.level} level)`,
        '',
        `What it looks for: ${check.summary}`,
        `Why it matters: ${check.why}`,
        `What to do: ${check.help}`,
        ...(check.when?.setting === undefined ? [] : [`Required setting: ${check.when.setting}`]),
        ...Object.entries(minVersions).map(([name, version]) => `Needs ${name} ${version} or newer`),
        '',
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.id)} --paths "<glob>" --reason "<why>"`,
        ...(check.command
            ? [`Turn one of its rules off: gspot ignore ${quoteArgument(check.id)} --rule <rule> --reason "<why>"`]
            : []),
        ...(check.run_in_copy === true ? ['Runs on a copy of the selected files in a temporary folder.'] : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(rules.length === 0 ? [] : [`Rules that state it: ${rules.join(', ')}`]),
        ...formatRepositoryUse(session, commandCheck, configuration),
    ];
    return `${lines.join('\n')}\n`;
}

/**
Explain a shipped check or a command check.

@param session the repository, or undefined outside one.
@param checkId the check ID to explain.
@returns the explanation, or undefined when no check has the ID.
*/
export function explainCheck(session: Session | undefined, checkId: string): Explanation | undefined {
    const configurations = readConfigurations();
    const commandCheck = session?.settingsFile.settings.commandChecks[checkId];
    const found: ScopeCheck | undefined =
        listChecksById(configurations.values()).get(checkId) ??
        (commandCheck === undefined ? undefined : { check: commandCheck, configuration: undefined });
    if (found === undefined) return undefined;
    const { check, configuration } = found;
    const facts = buildCheckFacts(
        check,
        configuration,
        configurations,
        new Set(session === undefined ? [] : selectRuleFiles(session).map((file) => file.path)),
    );
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
            when: check.when,
            ...stripUndefined({
                crash_pattern: facts.crashPattern,
                run_in_copy: check.run_in_copy,
            }),
            settings: facts.settings,
            rules: facts.rules,
        },
    };
}

/**
Explain one lint rule: its page, and how to turn it off or change its options.

@param tool the command or plugin prefix.
@param rule the ID without its prefix, such as no-console.
@returns the explanation, or undefined when no check runs the tool.
*/
export function explainLintRule(tool: string, rule: string): Explanation | undefined {
    const configurations = readConfigurations();
    const qualified = `${tool}/${rule}`;
    const plugin = findRulePlugin(extractRulePrefix(qualified) ?? tool, configurations);
    const [ruleTool, identifier] = plugin === undefined ? [tool, rule] : [ESLINT_MANIFEST_TOOL, qualified];
    const found = listChecksById(configurations.values())
        .values()
        .find(
            ({ check: declaration }) =>
                getToolName(declaration) === ruleTool || declaration.id.endsWith(`/${ruleTool}`),
        );
    if (!found) return undefined;
    const { check, configuration } = found;
    const page = findRulePage(ruleTool, identifier, configurations);
    const key = quoteArgument(`tools.${ruleTool}.rules`);
    const ruleExample = quoteArgument(`{ ${JSON.stringify(identifier)} = [<options>] }`);
    const optionLines = (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []).some(
        (setting) => setting.name === `tools.${ruleTool}.rules`,
    )
        ? [`Change its options: gspot set ${key} ${ruleExample}`]
        : [];
    const description =
        page === undefined ? `Read the ${ruleTool} documentation for ${identifier}.` : `The tool's page: ${page}`;
    const lines = [
        `${ruleTool}/${identifier}  (run by ${check.id})`,
        '',
        description,
        '',
        `Turn it off everywhere: gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(identifier)} --reason "<why>"`,
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(identifier)} --paths "<glob>" --reason "<why>"`,
        ...optionLines,
    ];
    return {
        kind: 'lint-rule',
        subject: `${ruleTool}/${identifier}`,
        text: `${lines.join('\n')}\n`,
        facts: { tool: ruleTool, rule: identifier, check: check.id, page: page ?? null },
    };
}
