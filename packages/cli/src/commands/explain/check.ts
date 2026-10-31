import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { CODE_MARK } from '#cli/config/main.ts';
import type { Session } from '#cli/types/session.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { RULE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { quoteCommand, quoteArgument } from '#cli/system/text.ts';
import { isConfigurationSelected } from '#cli/manifests/select.ts';
import { ruleDocumentationSchema } from '#cli/schemas/commands.ts';
import type { CommandCheck } from '#cli/types/settings/settings.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import type { Tool, Check, ScopeCheck, Configuration } from '#cli/types/manifests.ts';
import { listRuleFiles, listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import type { CheckFacts, CheckIgnore, Explanation, LintRuleDocs } from '#cli/types/commands/explain.ts';
import { getTool, findToolName, hasRuleOutput, extractRulePrefix, extractConfigName } from '#cli/manifests/tools.ts';

import {
    ESLINT_MANIFEST_TOOL,
    STYLELINT_MANIFEST_TOOL,
    JAVASCRIPT_CONFIGURATION,
} from '#cli/config/manifests/names.ts';
import {
    REPOSITORY_COMMAND,
    RUN_IN_COPY_MESSAGE,
    SELECTED_YES_MESSAGE,
    ESLINT_BUILTIN_RULES,
    INSTALL_FOR_RULES_MESSAGE,
} from '#cli/config/commands/explain.ts';

function findRulePlugin(prefix: string, configurationsByName: Map<string, Configuration>): Tool | undefined {
    return configurationsByName
        .values()
        .flatMap((configuration) => configuration.tools)
        .find((pin) => pin.rule_prefix === prefix);
}

function findRulePage(
    tool: string,
    rule: string,
    configurationsByName: Map<string, Configuration>,
): string | undefined {
    const prefix = extractRulePrefix(rule);
    if (prefix === undefined) {
        const pin = getTool(configurationsByName.values(), tool);
        return pin.rule_url?.replace(RULE_PLACEHOLDER, () => rule);
    }
    const plugin = findRulePlugin(prefix, configurationsByName);
    return plugin?.rule_url?.replace(RULE_PLACEHOLDER, () => rule.slice(prefix.length + 1));
}

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
                ...(paths === undefined ? [] : ['--paths', ...paths.map((path) => quoteArgument(path))]),
            ].join(' '),
        }));
}

function buildCheckFacts(
    check: Check,
    configuration: ScopeCheck['configuration'],
    configurationsByName: Map<string, Configuration>,
    session: Session | undefined,
): CheckFacts {
    const toolName = findToolName(check);
    const installedRules = new Set(session === undefined ? [] : selectRuleFiles(session).map((file) => file.path));
    const settings = (configuration === undefined ? [] : (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []))
        .filter((setting) => toolName !== undefined && setting.name.startsWith(`tools.${toolName}.`))
        .map((setting) => setting.name);
    const rules =
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
        rules,
        crashPattern,
        ignores: listCheckIgnores(session, check.id),
        minVersions: Object.fromEntries(
            [toolName, ...(check.other_tools ?? [])]
                .filter((name) => name !== undefined)
                .map((name) => getTool(configurationsByName.values(), name))
                .flatMap((tool) => (tool.min_version === undefined ? [] : [[tool.name, tool.min_version]])),
        ),
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
    const { source, settings, rules, minVersions } = facts;
    const lines = [
        `${check.id}  (${source}, ${check.stage} stage, ${check.level} level)`,
        '',
        `What it looks for: ${check.summary.replaceAll(CODE_MARK, '')}`,
        `Why it matters: ${check.why.replaceAll(CODE_MARK, '')}`,
        `What to do: ${check.help.replaceAll(CODE_MARK, '')}`,
        ...(check.when?.setting === undefined ? [] : [`Required setting: ${check.when.setting}`]),
        ...Object.entries(minVersions).map(([name, version]) => `Needs ${name} ${version} or newer`),
        '',
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.id)} --paths "<glob>" --reason "<why>"`,
        ...(hasRuleOutput(check)
            ? [`Turn one of its lint rules off: gspot ignore ${quoteArgument(check.id)} --rule <rule> --reason "<why>"`]
            : []),
        ...(check.run_in_copy === true ? [RUN_IN_COPY_MESSAGE] : []),
        ...(settings.length === 0
            ? []
            : [`Settings that change it: ${settings.join(', ')} (gspot set <setting> <value>)`]),
        ...(rules.length === 0 ? [] : [`Rule files that state it: ${rules.join(', ')}`]),
        ...formatRepositoryUse(session, commandCheck, configuration),
        ...(facts.ignores.length === 0 ? [] : ['Ignored in this repository:']),
        ...facts.ignores.map((ignore) => formatCheckIgnore(ignore)),
    ];
    return `${lines.join('\n')}\n`;
}

async function readEslintPluginRule(root: string, identifier: string): Promise<unknown> {
    const config = readConfigurations()
        .get(JAVASCRIPT_CONFIGURATION)
        ?.configs.find((file) => extractConfigName(file.file) === ESLINT_MANIFEST_TOOL);
    if (config === undefined) return undefined;
    let eslintConfig: { default: { plugins?: Record<string, { rules?: Record<string, unknown> }> }[] };
    try {
        eslintConfig = (await import(pathToFileURL(join(root, config.target)).href)) as typeof eslintConfig;
    } catch (error) {
        if (hasErrorCode(error, 'ERR_MODULE_NOT_FOUND')) throw new GspotError('tool', INSTALL_FOR_RULES_MESSAGE);
        throw error;
    }
    return eslintConfig.default
        .flatMap((block) => (block.plugins === undefined ? [] : Object.entries(block.plugins)))
        .map(([prefix, plugin]) =>
            identifier.startsWith(`${prefix}/`) ? plugin.rules?.[identifier.slice(prefix.length + 1)] : undefined,
        )
        .find((found) => found !== undefined);
}

async function readLintRule(root: string, tool: string, identifier: string): Promise<unknown> {
    const installed = await importInstalledTool(
        root,
        tool === STYLELINT_MANIFEST_TOOL ? STYLELINT_MANIFEST_TOOL : ESLINT_BUILTIN_RULES,
    );
    if (installed === undefined) throw new GspotError('tool', INSTALL_FOR_RULES_MESSAGE);
    if (tool === STYLELINT_MANIFEST_TOOL)
        return (installed as { default: { rules: Record<string, unknown> } }).default.rules[identifier];
    if (extractRulePrefix(identifier) === undefined)
        return (installed as { builtinRules: Map<string, unknown> }).builtinRules.get(identifier);
    return readEslintPluginRule(root, identifier);
}

async function readLintRuleDocs(root: string, tool: string, identifier: string): Promise<LintRuleDocs | undefined> {
    if (tool !== ESLINT_MANIFEST_TOOL && tool !== STYLELINT_MANIFEST_TOOL)
        return { description: undefined, url: undefined };
    const rule = await readLintRule(root, tool, identifier);
    if (rule === undefined) return undefined;
    const documentation = ruleDocumentationSchema.default({}).parse(Reflect.get(rule as object, 'meta'));
    return { description: documentation.docs?.description, url: documentation.docs?.url ?? documentation.url };
}

function formatLintRuleLines(
    found: { check: Check; configuration: Configuration },
    rule: { tool: string; identifier: string; page: string | undefined; description: string | undefined },
): string[] {
    const { check, configuration } = found;
    const { tool, identifier, page } = rule;
    const key = quoteArgument(`tools.${tool}.rules`);
    const ruleExample = quoteArgument(`{ ${JSON.stringify(identifier)} = [<options>] }`);
    const optionLines = (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []).some(
        (setting) => setting.name === `tools.${tool}.rules`,
    )
        ? [`Change its options: gspot set ${key} ${ruleExample}`]
        : [];
    return [
        `${tool}/${identifier}  (run by ${check.id})`,
        '',
        ...(rule.description === undefined ? [] : [`What it looks for: ${rule.description}`]),
        page === undefined ? `Read the ${tool} documentation for ${identifier}.` : `The tool's page: ${page}`,
        '',
        `Turn it off everywhere: gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(identifier)} --reason "<why>"`,
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(identifier)} --paths "<glob>" --reason "<why>"`,
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
            crash_pattern: facts.crashPattern,
            run_in_copy: check.run_in_copy,
            settings: facts.settings,
            rules: facts.rules,
            ignores: facts.ignores,
        },
    };
}

/**
Import a tool from the npm tool project of the repository.

@param root the repository root.
@param specifier the package or its export, such as eslint/use-at-your-own-risk.
@returns undefined when the tool project does not hold it.
*/
export async function importInstalledTool(root: string, specifier: string): Promise<unknown> {
    let path: string;
    try {
        path = createRequire(join(root, GSPOT_PATHS.npmProject)).resolve(specifier);
    } catch (error) {
        if (!hasErrorCode(error, 'MODULE_NOT_FOUND')) throw error;
        return undefined;
    }
    return import(pathToFileURL(path).href);
}

/**
Explain one lint rule: its page, its description from the installed tool, and how to turn it off or change its
options. ESLint and Stylelint rules must exist in the tools that gspot installed.

@param root the repository root, whose tool project holds ESLint and Stylelint.
@param tool the command or plugin prefix.
@param rule the ID without its prefix, such as no-console.
@returns undefined when no check runs the tool, or when ESLint or Stylelint has no such rule.
*/
export async function explainLintRule(root: string, tool: string, rule: string): Promise<Explanation | undefined> {
    const configurationsByName = readConfigurations();
    const qualified = `${tool}/${rule}`;
    const plugin = findRulePlugin(extractRulePrefix(qualified) ?? tool, configurationsByName);
    const [ruleTool, identifier] = plugin === undefined ? [tool, rule] : [ESLINT_MANIFEST_TOOL, qualified];
    const found = listChecksById(configurationsByName.values())
        .values()
        .find(
            ({ check: declaration }) =>
                findToolName(declaration) === ruleTool || declaration.id.endsWith(`/${ruleTool}`),
        );
    if (!found) return undefined;
    const docs = await readLintRuleDocs(root, ruleTool, identifier);
    if (docs === undefined) return undefined;
    const page = findRulePage(ruleTool, identifier, configurationsByName) ?? docs.url;
    const lines = formatLintRuleLines(found, {
        tool: ruleTool,
        identifier,
        page,
        description: docs.description,
    });
    return {
        kind: 'lint-rule',
        subject: `${ruleTool}/${identifier}`,
        text: `${lines.join('\n')}\n`,
        facts: {
            tool: ruleTool,
            rule: identifier,
            check: found.check.id,
            page: page ?? null,
            description: docs.description ?? null,
        },
    };
}
