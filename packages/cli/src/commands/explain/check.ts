// Explain a check, or one rule of the tool a check runs.
import { quoteArgument } from '#cli/system/text.ts';
import type { Session } from '#cli/types/planning.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { configurationSettings } from '#cli/settings/view.ts';
import { ESLINT_TOOL } from '#cli/config/generation/eslint.ts';
import { RULE_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { CommandCheck } from '#cli/types/settings/values.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import { getToolName, getToolDeclaration } from '#cli/configurations/tools.ts';
import type { Found, CheckFacts, Explanation } from '#cli/types/commands/explain.ts';
import { listRuleFiles, readManifests, listChecksById } from '#cli/configurations/manifests.ts';
import type { Manifest, ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';

function getRulePlugin(prefix: string, manifests: Map<string, Manifest>): ToolDeclaration | undefined {
    return manifests
        .values()
        .flatMap((manifest) => manifest.tools)
        .find((pin) => pin.rule_prefix === prefix);
}

// The page a manifest declares for a rule: the tool's own page, or the page of the plugin whose prefix the rule carries.
function getRulePage(
    check: CheckDeclaration,
    tool: string,
    rule: string,
    manifests: Map<string, Manifest>,
): string | undefined {
    const slash = rule.lastIndexOf('/');
    if (slash === -1) {
        const pin = getToolDeclaration(manifests.values(), tool, manifests.get(check.name.split('/', 1)[0] ?? ''));
        return pin.rule_url?.replace(RULE_PLACEHOLDER, rule);
    }
    const plugin = getRulePlugin(rule.slice(0, slash), manifests);
    return plugin?.rule_url?.replace(RULE_PLACEHOLDER, rule.slice(slash + 1));
}

// The settings that change the check, and the rules and crash pattern its configuration carries.
function getFacts(
    check: CheckDeclaration,
    configuration: Found['configuration'],
    manifests: Map<string, Manifest>,
): CheckFacts {
    const tool = getToolName(check);
    const settings = (configuration === undefined ? [] : configurationSettings(configuration.configuration.name))
        .filter(
            (setting) =>
                (check.name === 'structure/prefix-collisions' && setting.name === 'limits.prefix_collisions') ||
                (tool !== undefined && setting.name.startsWith(`tools.${tool}.`)),
        )
        .map((setting) => setting.name);
    const rules = configuration === undefined ? [] : listRuleFiles(configuration).map((file) => file.path);
    const crashPattern =
        check.crash_pattern ??
        (tool === undefined ? undefined : getToolDeclaration(manifests.values(), tool, configuration).crash_pattern);
    return {
        source:
            configuration === undefined ? 'repository command' : `${configuration.configuration.name} configuration`,
        settings,
        rules,
        crashPattern,
        minVersions: Object.fromEntries(
            (configuration?.tools ?? []).flatMap((tool) =>
                tool.min_version === undefined ? [] : [[tool.name, tool.min_version]],
            ),
        ),
    };
}

// The lines about this repository: a [[command_check]] entry's command and paths, or whether the selection includes the configuration.
function repositoryLines(
    session: Session | undefined,
    declared: CommandCheck | undefined,
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
    session: Session | undefined,
    found: Found,
    declared: CommandCheck | undefined,
    facts: CheckFacts,
): string {
    const { check, configuration } = found;
    const { source, settings, rules, crashPattern, minVersions } = facts;
    const lines = [
        `${check.name}  (${source}, ${check.stage} stage, ${check.level} level)`,
        '',
        `What it looks for: ${check.summary}`,
        `Why it matters: ${check.why}`,
        `What to do: ${check.help}`,
        ...(check.when?.setting === undefined ? [] : [`Required setting: ${check.when.setting}`]),
        ...Object.entries(minVersions).map(([name, version]) => `Needs ${name} ${version} or newer`),
        '',
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.name)} --paths "<glob>" --reason "..."`,
        ...(check.command
            ? [`Turn one of its rules off: gspot ignore ${quoteArgument(check.name)} --rule <rule> --reason "..."`]
            : []),
        ...(crashPattern === undefined ? [] : [`Output that means the tool crashed: ${crashPattern}`]),
        ...(check.run_in_copy === true ? ['Runs on a scratch copy of the selected files in a temporary folder.'] : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(rules.length === 0 ? [] : [`Rules that state it: ${rules.join(', ')}`]),
        ...repositoryLines(session, declared, configuration),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Explains a check by name: a shipped check, or a [[command_check]] entry of the settings.
 * @param session the session, or undefined outside a repository
 * @param checkName the check
 * @param reads the run cache.
 * @returns the explanation, or undefined when no check has the name
 */
export function explainCheck(
    session: Session | undefined,
    checkName: string,
    reads: ReadCache,
): Explanation | undefined {
    const manifests = readManifests(reads);
    const declared = session?.settingsFile.settings.check[checkName];
    const found: Found | undefined =
        listChecksById(manifests.values()).get(checkName) ??
        (declared === undefined ? undefined : { check: declared, configuration: undefined });
    if (found === undefined) return undefined;
    const { check, configuration } = found;
    const facts = getFacts(check, configuration, manifests);
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
 * Explains one rule of a tool: its declared documentation page, and how to turn it off or change its options.
 * @param tool the tool
 * @param rule the rule
 * @param reads the run cache.
 * @returns the explanation, or undefined when no check runs the tool
 */
export function explainLintRule(tool: string, rule: string, reads: ReadCache): Explanation | undefined {
    const manifests = readManifests(reads);
    const qualified = `${tool}/${rule}`;
    const plugin = getRulePlugin(qualified.slice(0, qualified.lastIndexOf('/')), manifests);
    const ruleTool = plugin === undefined ? tool : ESLINT_TOOL;
    const identifier = plugin === undefined ? rule : qualified;
    const found = listChecksById(manifests.values())
        .values()
        .find(
            ({ check: declaration }) =>
                getToolName(declaration) === ruleTool || declaration.name.endsWith(`/${ruleTool}`),
        );
    if (!found) return undefined;
    const { check, configuration } = found;
    const page = getRulePage(check, ruleTool, identifier, manifests);
    const key = quoteArgument(`tools.${ruleTool}.rules`);
    const entries = quoteArgument(`{ ${JSON.stringify(identifier)} = [<options>] }`);
    const optionLines = configurationSettings(configuration.configuration.name)
        .filter((setting) => setting.name === `tools.${ruleTool}.rules`)
        .map(() => `Change its options: gspot set ${key} ${entries}`);
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
        kind: 'lint-rule',
        subject: `${ruleTool}/${identifier}`,
        text: `${lines.join('\n')}\n`,
        data: { tool: ruleTool, rule: identifier, check: check.name, summary: null, page: page ?? null },
    };
}
