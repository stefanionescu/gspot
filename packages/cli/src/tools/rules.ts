import { devNull } from 'node:os';
import { pathToFileURL } from 'node:url';
import { runTool } from '#cli/tools/run.ts';
import { createRequire } from 'node:module';
import { getTool } from '#cli/tools/pins.ts';
import { isInside } from '#cli/system/paths.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { readFileSync, realpathSync } from 'node:fs';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { RULE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import type { Tool, Configuration } from '#cli/types/manifests.ts';
import { listExecutablePaths, listRepositoryExecutablePaths } from '#cli/tools/locate.ts';
import { ESLINT_MANIFEST_TOOL, STYLELINT_MANIFEST_TOOL } from '#cli/config/manifests/names.ts';
import type { LintRuleDocs, RuleToolSearch, RuleDocsOptions } from '#cli/types/tools/tools.ts';
import { ruffRuleSchema, installedRulesSchema, ruleDocumentationSchema } from '#cli/schemas/tools/tools.ts';

import {
    ESLINT_BUILTIN_RULES,
    MARKDOWNLINT_RULE_SCHEMA,
    SWIFTLINT_RULE_ARGUMENTS,
    INSTALL_FOR_RULES_MESSAGE,
    SWIFTLINT_RULE_IDENTIFIER,
    SHELLCHECK_RULE_IDENTIFIER,
    MARKDOWNLINT_RULE_DESCRIPTION,
} from '#cli/config/tools/tools.ts';

/**
Read the longest declared plugin prefix of a qualified lint rule.

@param rule the rule name, optionally prefixed by its plugin.
@returns undefined for an unqualified rule.
*/
function extractRulePrefix(rule: string): string | undefined {
    const prefixes = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.tools)
        .map((tool) => tool.rule_prefix)
        .filter((prefix): prefix is string => prefix !== undefined && rule.startsWith(`${prefix}/`))
        .toArray();
    prefixes.sort((first, second) => second.length - first.length);
    return prefixes[0];
}

/**
Resolve only a package installed inside the repository's tool project.

@param root the repository root.
@param specifier the package name or exported entry point.
@param subpath a catalog path relative to the installed entry point.
@returns undefined when gspot has not installed the tool.
*/
function findInstalledToolPath(root: string, specifier: string, subpath?: string): string | undefined {
    let path: string;
    try {
        path = createRequire(join(root, GSPOT_PATHS.npmProject)).resolve(specifier);
    } catch (error) {
        if (!hasErrorCode(error, 'MODULE_NOT_FOUND')) throw error;
        return undefined;
    }
    assertInstalledPath(root, specifier, path);
    if (subpath !== undefined) path = resolve(dirname(path), subpath);
    assertInstalledPath(root, specifier, path);
    return path;
}

function assertInstalledPath(root: string, specifier: string, path: string): void {
    const modules = join(realpathSync(root), GSPOT_PATHS.nodeModules);
    const canonical = realpathSync(path);
    if (!isInside(relative(modules, canonical)))
        throw new GspotError(
            'tool',
            `The installed ${specifier} resolves outside .gspot/node_modules. Run gspot install.`,
        );
}

async function importInstalledTool(root: string, specifier: string): Promise<unknown> {
    const path = findInstalledToolPath(root, specifier);
    if (path === undefined) return undefined;
    return import(pathToFileURL(path).href);
}

function readMarkdownlintRule(root: string, identifier: string): LintRuleDocs | undefined {
    const path = findInstalledToolPath(root, 'markdownlint', MARKDOWNLINT_RULE_SCHEMA);
    if (path === undefined) throw new GspotError('tool', 'Markdownlint is not installed. Run gspot install.');
    const ruleTable = parseJsonFile('markdownlint rule catalog', readFileSync(path, 'utf8'), installedRulesSchema);
    const match = MARKDOWNLINT_RULE_DESCRIPTION.exec(ruleTable.properties[identifier]?.description ?? '');
    const description = match?.[1];
    const url = match?.[2];
    return description === undefined || url === undefined ? undefined : { description, url };
}

async function readSwiftlintRule(
    root: string,
    identifier: string,
    options: RuleToolSearch,
): Promise<LintRuleDocs | undefined> {
    if (!SWIFTLINT_RULE_IDENTIFIER.test(identifier)) return undefined;
    const { timeoutSeconds } = options;
    const [path] = listExecutablePaths(root, 'swiftlint', {
        folders: [],
        timeoutSeconds,
        miseBinPaths: options.readMiseBinPaths?.(),
    });
    if (path === undefined) throw new GspotError('tool', 'SwiftLint is not installed. Run gspot install.');
    const result = await runTool([path, ...SWIFTLINT_RULE_ARGUMENTS, devNull, identifier], {
        cwd: root,
        timeoutSeconds,
    });
    if ([result.timedOut, result.errored, result.missing, result.canceled].some(Boolean))
        throw new GspotError('tool', `SwiftLint could not read rule ${identifier}. ${result.stderr.trim()}`);
    if (result.code !== 0) return undefined;
    const url = findRulePage('swiftlint', identifier, readConfigurations());
    return { description: result.stdout.trim(), ...(url === undefined ? {} : { url }) };
}

function findManifestRulePage(tool: string, identifier: string): string | undefined {
    const configurations = readConfigurations();
    if (tool === 'shellcheck' && !SHELLCHECK_RULE_IDENTIFIER.test(identifier)) return undefined;
    if (
        tool === 'biome' &&
        (!identifier.startsWith('lint/') ||
            !configurations
                .values()
                .some((configuration) =>
                    configuration.checks.some(
                        (check) => check.command?.includes(`--only=${identifier.slice('lint/'.length)}`) === true,
                    ),
                ))
    )
        return undefined;
    return findRulePage(tool, identifier, configurations);
}

function readManifestRuleDocs(tool: string, identifier: string): LintRuleDocs | undefined {
    const page = findManifestRulePage(tool, identifier);
    if (page === undefined) return undefined;
    return { url: page };
}

async function readEslintPluginRule(root: string, identifier: string): Promise<unknown> {
    const prefix = extractRulePrefix(identifier);
    if (prefix === undefined) return undefined;
    const plugin = findRulePlugin(prefix, readConfigurations());
    const npm = plugin?.installers['npm'];
    if (npm === undefined) return undefined;
    const installed = await importInstalledTool(root, npm.name);
    if (installed === undefined) throw new GspotError('tool', INSTALL_FOR_RULES_MESSAGE);
    const exported = findValueAt(installed, ['default']) ?? installed;
    const rules = findValueAt(exported, ['rules']) ?? findValueAt(exported, ['plugin', 'rules']);
    return findValueAt(rules, [identifier.slice(prefix.length + 1)]);
}

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

async function readRuffRule(
    root: string,
    identifier: string,
    timeoutSeconds: number,
): Promise<LintRuleDocs | undefined> {
    const [path] = listRepositoryExecutablePaths(root, 'ruff', { folders: [], toolFolderKind: 'python' });
    if (path === undefined) throw new GspotError('tool', 'Ruff is not installed in .gspot/.venv. Run gspot install.');
    const result = await runTool([path, 'rule', identifier, '--output-format', 'json'], { cwd: root, timeoutSeconds });
    if ([result.timedOut, result.errored, result.missing, result.canceled].some(Boolean))
        throw new GspotError('tool', `Ruff could not read rule ${identifier}. ${result.stderr.trim()}`);
    if (result.code !== 0) return undefined;
    const rule = parseJsonFile('ruff rule output', result.stdout, ruffRuleSchema);
    return {
        description: rule.summary,
        explanation: rule.explanation,
        url: `https://docs.astral.sh/ruff/rules/${rule.name}/`,
    };
}

async function readInstalledRule(root: string, tool: string, identifier: string): Promise<unknown> {
    if (tool === ESLINT_MANIFEST_TOOL && identifier.includes('/')) return readEslintPluginRule(root, identifier);
    const specifier = tool === ESLINT_MANIFEST_TOOL ? ESLINT_BUILTIN_RULES : tool;
    const installed = await importInstalledTool(root, specifier);
    if (installed === undefined) throw new GspotError('tool', INSTALL_FOR_RULES_MESSAGE);
    if (tool === STYLELINT_MANIFEST_TOOL) return readStylelintRule(installed, identifier);
    const rules: unknown = findValueAt(installed, ['builtinRules']);
    if (!(rules instanceof Map)) throw new Error('The installed ESLint package has no builtinRules map.');
    return rules.get(identifier);
}

async function readStylelintRule(installed: unknown, identifier: string): Promise<unknown> {
    const exported = findValueAt(installed, ['default']);
    const rules: unknown = Reflect.get(new Object(exported), 'rules');
    return await findValueAt(rules, [identifier]);
}

function readRuleMetadata(rule: unknown, page: string | undefined): LintRuleDocs {
    if (typeof rule !== 'object' && typeof rule !== 'function')
        throw new Error('The installed rule has no implementation.');
    if (rule === null) throw new Error('The installed rule has no implementation.');
    const metadata = ruleDocumentationSchema.default({}).parse(Reflect.get(rule, 'meta'));
    const docs = { ...metadata.docs };
    const url = metadata.url ?? page;
    if (docs.url === undefined && url !== undefined) docs.url = url;
    return docs;
}

/**
Read rule documentation from an installed tool without importing generated configuration.

@param root the repository root.
@param tool the program that runs the rule.
@param identifier the complete rule identifier.
@param options the subprocess time limit and installed mise tool locator.
@param options.timeoutSeconds the subprocess time limit.
@param options.readMiseBinPaths locates the tools through the validated generated tool project.
*/
export async function readLintRuleDocs(
    root: string,
    tool: string,
    identifier: string,
    {
        timeoutSeconds = rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        readMiseBinPaths,
    }: RuleDocsOptions = {},
): Promise<LintRuleDocs | undefined> {
    if (tool === 'ruff') return readRuffRule(root, identifier, timeoutSeconds);
    if (tool === 'markdownlint-cli2') return readMarkdownlintRule(root, identifier);
    if (tool === 'swiftlint') return readSwiftlintRule(root, identifier, { timeoutSeconds, readMiseBinPaths });
    if (![ESLINT_MANIFEST_TOOL, STYLELINT_MANIFEST_TOOL].includes(tool)) return readManifestRuleDocs(tool, identifier);
    const rule = await readInstalledRule(root, tool, identifier);
    if (rule === undefined) return undefined;
    return readRuleMetadata(rule, findRulePage(tool, identifier, readConfigurations()));
}
