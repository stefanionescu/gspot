// Explain a check, or one lint rule of the tool that a check runs.
import { quoteArgument } from '#cli/system/text.ts';
import type { Session } from '#cli/types/planning.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { ESLINT_TOOL } from '#cli/config/generation/eslint.ts';
import { RULE_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { CommandCheck } from '#cli/types/settings/values.ts';
import { listConfigurationSettings } from '#cli/settings/known.ts';
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

// Find the page for a lint rule: the tool page, or the page of the plugin that the rule prefix names.
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

// List the settings that change the check, and the rules and crash pattern of its configuration.
function getFacts(
    check: CheckDeclaration,
    configuration: Found['configuration'],
    manifests: Map<string, Manifest>,
    installedRules: ReadonlySet<string>,
): CheckFacts {
    const tool = getToolName(check);
    const settings = (configuration === undefined ? [] : listConfigurationSettings(configuration.configuration.name))
        .filter(
            (setting) =>
                (check.name === 'structure/shared-prefixes' && setting.name === 'limits.shared_prefix_files') ||
                (tool !== undefined && setting.name.startsWith(`tools.${tool}.`)),
        )
        .map((setting) => setting.name);
    const rules =
        configuration === undefined
            ? []
            : listRuleFiles(configuration)
                  .filter((file) => installedRules.has(file.path))
                  .map((file) => file.path);
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

// Describe use in this repository: the command and paths of a [[command_check]] record, or whether the configuration runs here.
function formatRepositoryUse(
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
    const { source, settings, rules, minVersions } = facts;
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
        ...(check.run_in_copy === true ? ['Runs on a scratch copy of the selected files in a temporary folder.'] : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(rules.length === 0 ? [] : [`Rules that state it: ${rules.join(', ')}`]),
        ...formatRepositoryUse(session, declared, configuration),
    ];
    return `${lines.join('\n')}\n`;
}

/**
 * Explain a shipped check or a command check.
 * @param session the repository, or undefined outside one.
 * @param checkName the check ID to explain.
 * @param reads the file cache for this run.
 * @returns the explanation, or undefined when no check has the ID.
 */
export function explainCheck(
    session: Session | undefined,
    checkName: string,
    reads: ReadCache,
): Explanation | undefined {
    const manifests = readManifests(reads);
    const declared = session?.settingsFile.settings.commandChecks[checkName];
    const found: Found | undefined =
        listChecksById(manifests.values()).get(checkName) ??
        (declared === undefined ? undefined : { check: declared, configuration: undefined });
    if (found === undefined) return undefined;
    const { check, configuration } = found;
    const facts = getFacts(
        check,
        configuration,
        manifests,
        new Set(session === undefined ? [] : selectRuleFiles(session).map((file) => file.path)),
    );
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
 * Explain one lint rule: its page, and how to turn it off or change its options.
 * @param tool the command or plugin prefix.
 * @param rule the ID without its prefix, such as no-console.
 * @param reads the file cache for this run.
 * @returns the explanation, or undefined when no check runs the tool.
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
    const optionLines = listConfigurationSettings(configuration.configuration.name)
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
