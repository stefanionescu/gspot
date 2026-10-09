// Explain a check, or one rule of the tool a check runs.
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { compact, quoteArgument } from '#cli/platform/contracts.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { toolName, allChecks } from '#cli/configurations/contracts.ts';
import type { RepositoryDefinition } from '#cli/types/policy/settings.ts';
import type { Found, CheckFacts, Explanation } from '#cli/types/commands/explain.ts';
import { configurationFiles, configurationManifests, isConfigurationSelected } from '#cli/configurations/public.ts';

function getToolPin(name: string | undefined, check?: CheckDeclaration): ToolPin | undefined {
    if (name === undefined) return undefined;
    const owner = check?.name.split('/', 1)[0];
    const declared =
        owner === undefined
            ? undefined
            : configurationManifests()
                  .get(owner)
                  ?.tools.find((entry) => entry.name === name);
    if (declared !== undefined) return declared;
    return configurationManifests()
        .values()
        .flatMap((manifest) => manifest.tools)
        .find((entry) => entry.name === name);
}

function getRulePlugin(prefix: string): ToolPin | undefined {
    return configurationManifests()
        .values()
        .flatMap((manifest) => manifest.tools)
        .find((pin) => pin.rule_prefix === prefix);
}

// The page a manifest declares for a rule: the tool's own page, or the page of the plugin whose prefix the rule carries.
function getRulePage(check: CheckDeclaration, tool: string, rule: string): string | undefined {
    const slash = rule.lastIndexOf('/');
    if (slash === -1) {
        const pin = getToolPin(tool, check) ?? getToolPin(toolName(check), check);
        return pin?.rule_url?.replace('{rule}', rule);
    }
    const plugin = getRulePlugin(rule.slice(0, slash));
    return plugin?.rule_url?.replace('{rule}', rule.slice(slash + 1));
}

// The settings that change the check, and the rules and crash pattern its configuration carries.
function getFacts(check: CheckDeclaration, configuration: Found['configuration']): CheckFacts {
    const tool = toolName(check);
    const settings = (configuration?.settings ?? [])
        .filter(
            (setting) =>
                setting.name === check.limit || (tool !== undefined && setting.name.startsWith(`tools.${tool}.`)),
        )
        .map((setting) => setting.name);
    const agentRules = configuration === undefined ? [] : configurationFiles(configuration).map((file) => file.path);
    const crashPattern = check.crash_pattern ?? getToolPin(tool, check)?.crash_pattern;
    return {
        source:
            configuration === undefined ? 'repository command' : `${configuration.configuration.name} configuration`,
        settings,
        agentRules,
        crashPattern,
        minVersions: check.min_versions,
        versionRequirements: (check.min_versions === undefined ? [] : Object.entries(check.min_versions)).map(
            ([name, floor]) => `Required native version: ${name} >= ${floor}`,
        ),
    };
}

// The lines about this repository: a [[check]] entry's command and paths, or whether the configuration is selected.
function repositoryLines(
    session: ToolSession | undefined,
    declared: RepositoryDefinition | undefined,
    configuration: Found['configuration'],
): string[] {
    const lines: string[] = [];
    if (declared !== undefined)
        lines.push(
            `Command: ${declared.command.map((part) => quoteArgument(part)).join(' ')}`,
            `Paths: ${declared.files.paths.join(', ')}`,
        );
    if (session && configuration !== undefined)
        lines.push(
            isConfigurationSelected(session.scopes, configuration.configuration.name)
                ? 'Selected in this repository: yes'
                : `Selected in this repository: no (gspot add ${configuration.configuration.name})`,
        );
    return lines;
}

function describeCheck(
    session: ToolSession | undefined,
    found: Found,
    declared: RepositoryDefinition | undefined,
    facts: CheckFacts,
): string {
    const { check, configuration } = found;
    const { source, settings, agentRules, crashPattern, versionRequirements } = facts;
    const lines = [
        `${check.name}  (${source}, ${check.stage} stage, ${check.level} level)`,
        '',
        `What it looks for: ${check.summary}`,
        `Why it matters: ${check.why}`,
        `What to do: ${check.help}`,
        ...(check.when?.setting === undefined ? [] : [`Required setting: ${check.when.setting}`]),
        ...versionRequirements,
        '',
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.name)} --paths "<glob>" --reason "..."`,
        ...(check.command
            ? [`Turn one of its rules off: gspot ignore ${quoteArgument(check.name)} --rule <rule> --reason "..."`]
            : []),
        ...(crashPattern === undefined ? [] : [`Fatal tool diagnostic pattern: ${crashPattern}`]),
        ...(check.run_in_copy === true
            ? ['Runs with selected files and declared configuration in an isolated directory.']
            : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(agentRules.length === 0 ? [] : [`Agent rules that state it: ${agentRules.join(', ')}`]),
        ...repositoryLines(session, declared, configuration),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Explains a check by name: a shipped check, or a [[check]] entry of the policy.
 * @param session the session, or undefined outside a repository
 * @param checkName the check
 * @returns the explanation, or undefined when no check has the name
 */
export function explainCheck(session: ToolSession | undefined, checkName: string): Explanation | undefined {
    const declared = session?.policyFiles.policy.check[checkName];
    const found: Found | undefined =
        allChecks(configurationManifests().values()).get(checkName) ??
        (declared === undefined ? undefined : { check: declared, configuration: undefined });
    if (found === undefined) return undefined;
    const { check, configuration } = found;
    const facts = getFacts(check, configuration);
    return {
        kind: 'check',
        subject: checkName,
        text: describeCheck(session, found, declared, facts),
        data: {
            check: checkName,
            ...(configuration === undefined
                ? { command: check.command, paths: check.files.paths }
                : { configuration: configuration.configuration.name }),
            stage: check.stage,
            level: check.level,
            summary: check.summary,
            why: check.why,
            help: check.help,
            when: check.when,
            ...compact({
                min_versions: facts.minVersions,
                crash_pattern: facts.crashPattern,
                run_in_copy: check.run_in_copy,
                path_prefix: check.path_prefix,
            }),
            settings: facts.settings,
            agentRules: facts.agentRules,
        },
    };
}

/**
 * Explains one rule of a tool: its declared documentation page, and how to turn it off or change its options.
 * @param tool the tool
 * @param rule the rule
 * @returns the explanation, or undefined when no check runs the tool
 */
export function explainToolRule(tool: string, rule: string): Explanation | undefined {
    const qualified = `${tool}/${rule}`;
    const plugin = getRulePlugin(qualified.slice(0, qualified.lastIndexOf('/')));
    const ruleTool = plugin === undefined ? tool : 'eslint';
    const identifier = plugin === undefined ? rule : qualified;
    const found = allChecks(configurationManifests().values())
        .values()
        .find(
            ({ check: declaration }) => toolName(declaration) === ruleTool || declaration.name.endsWith(`/${ruleTool}`),
        );
    if (!found) return undefined;
    const { check, configuration } = found;
    const page = getRulePage(check, ruleTool, identifier);
    const key = quoteArgument(`tools.${ruleTool}.rules.${identifier}`);
    const optionLines = configuration.settings
        .filter((setting) => setting.name === `tools.${ruleTool}.rules`)
        .map(() => `Change its options: gspot set ${key} <options> --reason "..."`);
    let description = `Read the ${ruleTool} documentation for ${identifier}.`;
    if (page !== undefined) description = `The tool's page: ${page}`;
    const lines = [
        `${ruleTool}/${identifier}  (run by ${check.name})`,
        '',
        description,
        '',
        `Turn it off everywhere: gspot ignore ${quoteArgument(check.name)} --rule ${quoteArgument(identifier)} --reason "..."`,
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.name)} --rule ${quoteArgument(identifier)} --paths "<glob>" --reason "..."`,
        ...optionLines,
    ];
    return {
        kind: 'tool-rule',
        subject: `${ruleTool}/${identifier}`,
        text: `${lines.join('\n')}\n`,
        data: { tool: ruleTool, rule: identifier, check: check.name, summary: null, page: page ?? null },
    };
}
