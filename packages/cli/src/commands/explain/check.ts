// Explain a check, or one rule of the tool a check runs.
import { compact } from '#cli/platform/objects.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { quoteArgument } from '#cli/platform/text.ts';
import { toolName } from '#cli/configurations/pins.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { parseRuffRuleSummary } from '#cli/parsers/tool/rule.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import type { RepositoryDefinition } from '#cli/types/policy/settings.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { ToolPin, CheckDeclaration } from '#cli/types/configurations.ts';
import { allChecks, configurationFiles } from '#cli/configurations/declarations.ts';
import type { Found, CheckFacts, Explanation, RuleSummarizer } from '#cli/types/commands/explain.ts';
import { ESLINT_RULE_PACKAGES, SWIFTLINT_LINE_LIMIT, RULE_LOOKUP_TIMEOUT_MS } from '#cli/config/commands/explain.ts';

const RULE_SUMMARIZERS: Record<string, RuleSummarizer> = {
    ruff: (rule, path) => {
        const result = runBlocking([path, 'rule', rule, '--output-format', 'json'], {
            cwd: process.cwd(),
            timeoutMs: RULE_LOOKUP_TIMEOUT_MS,
        });
        if (result.code !== 0) return undefined;
        try {
            return parseRuffRuleSummary(result.stdout);
        } catch {
            return undefined;
        }
    },
    swiftlint: (rule, path) => {
        const result = runBlocking([path, 'rules', rule], { cwd: process.cwd(), timeoutMs: RULE_LOOKUP_TIMEOUT_MS });
        return result.code === 0
            ? result.stdout.split('\n').slice(0, SWIFTLINT_LINE_LIMIT).join('\n').trim()
            : undefined;
    },
};

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

function getRulePlugin(prefix: string, tool: string): ToolPin | undefined {
    const name = prefix.replace(/^@/u, '');
    return [ESLINT_RULE_PACKAGES[name], `${tool}-plugin-${name}`, `@${name}/${tool}-plugin`]
        .map((packageName) => getToolPin(packageName))
        .find((pin) => pin !== undefined);
}

// The page a manifest declares for a rule: the tool's own page, or the page of the plugin whose prefix the rule carries.
function getRulePage(check: CheckDeclaration, tool: string, rule: string): string | undefined {
    const slash = rule.lastIndexOf('/');
    if (slash === -1) {
        const pin = getToolPin(tool, check) ?? getToolPin(toolName(check), check);
        return pin?.rule_url?.replace('{rule}', rule);
    }
    const plugin = getRulePlugin(rule.slice(0, slash), tool);
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
    const guides = configuration === undefined ? [] : configurationFiles(configuration).map((file) => file.path);
    const crashPattern = check.crash_pattern ?? getToolPin(tool, check)?.crash_pattern;
    return {
        source:
            configuration === undefined ? 'repository command' : `${configuration.configuration.name} configuration`,
        settings,
        guides,
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
    const { source, settings, guides, crashPattern, versionRequirements } = facts;
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
        ...(settings.length === 0 ? [] : [`Settings that change it: ${settings.join(', ')} (gspot set <key> <value>)`]),
        ...(guides.length === 0 ? [] : [`Guides that state it: ${guides.join(', ')}`]),
        ...repositoryLines(session, declared, configuration),
    ];
    return `${lines.join('\n')}\n`;
}

function getRuleSummary(session: ToolSession | undefined, tool: string, rule: string): string | undefined {
    const summarize = RULE_SUMMARIZERS[tool];
    if (!summarize) return undefined;
    const pin = getToolPin(tool);
    const inspection = session && pin ? inspectTool(session, pin) : undefined;
    return summarize(rule, inspection?.path ?? tool);
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
            guides: facts.guides,
        },
    };
}

/**
 * Explains one rule of a tool: what the tool says about it, and how to turn it off or change its options.
 * @param session the session, or undefined outside a repository
 * @param tool the tool
 * @param rule the rule
 * @returns the explanation, or undefined when no check runs the tool
 */
export function explainToolRule(session: ToolSession | undefined, tool: string, rule: string): Explanation | undefined {
    const plugin = getRulePlugin(tool, 'eslint');
    const ruleTool = plugin === undefined ? tool : 'eslint';
    const identifier = plugin === undefined ? rule : `${tool}/${rule}`;
    const found = allChecks(configurationManifests().values())
        .values()
        .find(
            ({ check: declaration }) => toolName(declaration) === ruleTool || declaration.name.endsWith(`/${ruleTool}`),
        );
    if (!found) return undefined;
    const { check, configuration } = found;
    const summary = getRuleSummary(session, ruleTool, identifier);
    const page = getRulePage(check, ruleTool, identifier);
    const key = quoteArgument(`tools.${ruleTool}.rules.${identifier}`);
    const optionLines = configuration.settings
        .filter((setting) => setting.name === `tools.${ruleTool}.rules`)
        .map(() => `Change its options: gspot set ${key} <options> --reason "..."`);
    let description = `Read the ${ruleTool} documentation for ${identifier}.`;
    if (page !== undefined) description = `The tool's page: ${page}`;
    if (summary !== undefined) description = `The tool says: ${summary}`;
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
        data: { tool: ruleTool, rule: identifier, check: check.name, summary: summary ?? null, page: page ?? null },
    };
}
