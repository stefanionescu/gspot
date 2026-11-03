import { devNull } from 'node:os';
import { pathToFileURL } from 'node:url';
import { runTool } from '#cli/tools/run.ts';
import { createRequire } from 'node:module';
import { getTool } from '#cli/tools/pins.ts';
import { isInside } from '#cli/system/paths.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { readFileSync, realpathSync } from 'node:fs';
import { findText } from '#cli/system/files/reads.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { hasValePackages } from '#cli/tools/installers/vale.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import type { Tool, Configuration } from '#cli/types/manifests.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/repository/setup.ts';
import { GSPOT_PATHS, RULE_PLACEHOLDER } from '#cli/config/manifests.ts';
import type { LintRuleDocs, RuleToolSearch, RuleDocsOptions } from '#cli/types/tools.ts';
import { listExecutablePaths, listRepositoryExecutablePaths } from '#cli/tools/locate.ts';
import { VALE_TOOL, VALE_STYLES_PATH, VALE_RULE_IDENTIFIER, VALE_PACKAGES_MESSAGE } from '#cli/config/tools/vale.ts';
import { ruffRuleSchema, valeRuleSchema, installedRulesSchema, ruleDocumentationSchema } from '#cli/schemas/tools.ts';

import {
    ESLINT_BUILTIN_RULES,
    STYLELINT_MANIFEST_TOOL,
    MARKDOWNLINT_RULE_SCHEMA,
    SWIFTLINT_RULE_ARGUMENTS,
    INSTALL_FOR_RULES_MESSAGE,
    SWIFTLINT_RULE_IDENTIFIER,
    SHELLCHECK_RULE_IDENTIFIER,
    MARKDOWNLINT_RULE_DESCRIPTION,
} from '#cli/config/tools/programs.ts';

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
    if (path === undefined) throw new GspotError('tool', INSTALL_FOR_RULES_MESSAGE);
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
    const { paths } = await listExecutablePaths(root, 'swiftlint', {
        folders: [],
        timeoutSeconds,
        miseBinPaths: await options.readMiseBinPaths?.(),
    });
    const [path] = paths;
    if (path === undefined) throw new GspotError('tool', 'SwiftLint is not installed. Run gspot install.');
    const result = await runTool([path, ...SWIFTLINT_RULE_ARGUMENTS, devNull, identifier], {
        cwd: root,
        timeoutSeconds,
    });
    if ([result.timedOut, result.errored, result.missing, result.canceled].some(Boolean))
        throw new GspotError('tool', `SwiftLint could not read rule ${identifier}. ${result.stderr.trim()}`);
    if (result.code !== 0) return undefined;
    const url = findRulePage('swiftlint', identifier, readConfigurations());
    return { description: result.stdout.trim(), ...(url !== undefined && { url }) };
}

function readManifestRuleDocs(tool: string, identifier: string): LintRuleDocs | undefined {
    if (tool === 'shellcheck' && !SHELLCHECK_RULE_IDENTIFIER.test(identifier)) return undefined;
    const configurations = readConfigurations();
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
    const url = findRulePage(tool, identifier, configurations);
    return url === undefined ? undefined : { url };
}

async function readEslintPluginRule(root: string, identifier: string): Promise<unknown> {
    const prefix = extractRulePrefix(identifier);
    if (prefix === undefined) return undefined;
    const plugin = findRulePlugin(prefix, readConfigurations());
    const npm = plugin?.installers['npm'];
    if (npm === undefined) return undefined;
    const installed = await importInstalledTool(root, npm.name);
    const exported = findValueAt(installed, ['default']) ?? installed;
    const rules = findValueAt(exported, ['rules']) ?? findValueAt(exported, ['plugin', 'rules']);
    return findValueAt(rules, [identifier.slice(prefix.length + 1)]);
}

function findRulePlugin(prefix: string, configurationsByName: ReadonlyMap<string, Configuration>): Tool | undefined {
    return configurationsByName
        .values()
        .flatMap((configuration) => configuration.tools)
        .find((pin) => pin.rule_prefix === prefix);
}

function findRulePage(
    tool: string,
    rule: string,
    configurationsByName: ReadonlyMap<string, Configuration>,
): string | undefined {
    const prefix = extractRulePrefix(rule);
    if (prefix === undefined) {
        const pin = getTool(configurationsByName.values(), tool);
        return pin.rule_url?.replace(RULE_PLACEHOLDER, () => rule);
    }
    const plugin = findRulePlugin(prefix, configurationsByName);
    return plugin?.rule_url?.replace(RULE_PLACEHOLDER, () => rule.slice(prefix.length + 1));
}

function readValeRule(root: string, identifier: string): LintRuleDocs | undefined {
    if (!VALE_RULE_IDENTIFIER.test(identifier)) return undefined;
    if (!hasValePackages(root)) throw new GspotError('tool', VALE_PACKAGES_MESSAGE);
    for (const folder of [VALE_STYLES_PATH, GSPOT_PATHS.valePackages]) {
        const path = `${folder}/${identifier.replace('.', '/')}.yml`;
        const text = findText(root, path);
        if (text !== undefined) {
            const { message, link } = parseYamlFile(path, text, valeRuleSchema);
            return { description: message, ...(link !== undefined && { url: link }) };
        }
    }
    return undefined;
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
    if (tool === STYLELINT_MANIFEST_TOOL) return readStylelintRule(installed, identifier);
    const rules: unknown = findValueAt(installed, ['builtinRules']);
    if (!(rules instanceof Map)) throw new TypeError('The installed ESLint package has no builtinRules map.');
    return rules.get(identifier);
}

async function readStylelintRule(installed: unknown, identifier: string): Promise<unknown> {
    const exported = findValueAt(installed, ['default']);
    const rules: unknown = Reflect.get(new Object(exported), 'rules');
    return await findValueAt(rules, [identifier]);
}

function getRuleMetadata(rule: unknown, page: string | undefined): LintRuleDocs {
    if (typeof rule !== 'object' && typeof rule !== 'function')
        throw new TypeError('The installed rule has no implementation.');
    if (rule === null) throw new Error('The installed rule has no implementation.');
    const metadata = ruleDocumentationSchema.default({}).parse(Reflect.get(rule, 'meta'));
    const docs = { ...metadata.docs };
    const url = metadata.url ?? page;
    if (url !== undefined && docs.url === undefined) docs.url = url;
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
    const readRule = new Map<string, () => LintRuleDocs | undefined | Promise<LintRuleDocs | undefined>>([
        ['ruff', () => readRuffRule(root, identifier, timeoutSeconds)],
        ['markdownlint-cli2', () => readMarkdownlintRule(root, identifier)],
        [VALE_TOOL, () => readValeRule(root, identifier)],
        ['swiftlint', () => readSwiftlintRule(root, identifier, { timeoutSeconds, readMiseBinPaths })],
    ]).get(tool);
    if (readRule !== undefined) return readRule();
    if (![ESLINT_MANIFEST_TOOL, STYLELINT_MANIFEST_TOOL].includes(tool)) return readManifestRuleDocs(tool, identifier);
    const rule = await readInstalledRule(root, tool, identifier);
    return rule === undefined ? undefined : getRuleMetadata(rule, findRulePage(tool, identifier, readConfigurations()));
}
