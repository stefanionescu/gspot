import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GSPOT_PATHS, RULE_PLACEHOLDER } from '#cli/config/manifests.ts';
import { ESLINT_MANIFEST_TOOL } from '#cli/config/repository/setup.ts';
import {
    ESLINT_BUILTIN_RULES,
    INSTALL_FOR_RULES_MESSAGE,
    MARKDOWNLINT_RULE_DESCRIPTION,
    MARKDOWNLINT_RULE_SCHEMA,
    SHELLCHECK_RULE_IDENTIFIER,
    STYLELINT_MANIFEST_TOOL,
    SWIFTLINT_RULE_ARGUMENTS,
    SWIFTLINT_RULE_IDENTIFIER,
} from '#cli/config/tools/programs.ts';
import { VALE_PACKAGES_MESSAGE, VALE_RULE_IDENTIFIER, VALE_STYLES_PATH, VALE_TOOL } from '#cli/config/tools/vale.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { installedRulesSchema, ruffRuleSchema, ruleDocumentationSchema, valeRuleSchema } from '#cli/schemas/tools.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isInside } from '#cli/system/paths.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { hasValePackages } from '#cli/tools/installers/vale.ts';
import { listExecutablePaths, listRepositoryExecutablePaths } from '#cli/tools/locate.ts';
import { getTool } from '#cli/tools/pins.ts';
import { runTool } from '#cli/tools/run.ts';
import type { Tool } from '#cli/types/manifests.ts';
import type { RuleExplanation, RuleExplanationOptions, RuleToolSearch } from '#cli/types/tools.ts';

const RULE_READER_TOOLS: ReadonlySet<string> = new Set([
    'ruff',
    'markdownlint-cli2',
    VALE_TOOL,
    'swiftlint',
    ESLINT_MANIFEST_TOOL,
    STYLELINT_MANIFEST_TOOL,
]);

const RUFF_SUMMARY_FIELD = /\{(\w+)?(?::[^{}]*)?\}/gu;

const SWIFTLINT_UNKNOWN_RULE = 'No rule with identifier';

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

function isUnlistedRule(tool: string, rule: string): boolean {
    if (tool === VALE_TOOL) return rule.startsWith('Vale.');
    if (tool === 'biome') return !rule.startsWith('lint/');
    if (tool !== ESLINT_MANIFEST_TOOL && tool !== STYLELINT_MANIFEST_TOOL) return false;
    return rule === 'CssSyntaxError' || (rule.includes('/') && extractRulePrefix(rule) === undefined);
}

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

function readMarkdownlintRule(root: string, identifier: string): RuleExplanation | undefined {
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
): Promise<RuleExplanation | undefined> {
    if (!SWIFTLINT_RULE_IDENTIFIER.test(identifier)) return undefined;
    const { timeoutSeconds, help } = options;
    const { paths } = await listExecutablePaths(root, 'swiftlint', {
        folders: [],
        timeoutSeconds,
        miseBinPaths: await options.readMiseBinPaths?.(),
    });
    const [path] = paths;
    if (path === undefined) throw new GspotError('tool', 'SwiftLint is not installed. Run gspot install.');
    // SwiftLint stops with a permission error on a device file, so it reads an empty regular file.
    using folder = createTemporaryFolder();
    const emptyConfig = join(folder.path, 'swiftlint.yml');
    writeFileSync(emptyConfig, '');
    const result = await runTool([path, ...SWIFTLINT_RULE_ARGUMENTS, emptyConfig, identifier], {
        cwd: root,
        timeoutSeconds,
    });
    if (result.stderr.includes(SWIFTLINT_UNKNOWN_RULE)) return undefined;
    if (result.end !== 'exited' || result.code !== 0) return { fix: help };
    const url = findRulePage('swiftlint', identifier);
    return { description: result.stdout.trim(), ...(url !== undefined && { url }) };
}

function readManifestRuleExplanation(tool: string, identifier: string): RuleExplanation | undefined {
    if (tool === 'shellcheck' && !SHELLCHECK_RULE_IDENTIFIER.test(identifier)) return undefined;
    if (
        tool === 'biome' &&
        (!identifier.startsWith('lint/') ||
            !readConfigurations()
                .values()
                .some((configuration) =>
                    configuration.checks.some(
                        (check) => check.command?.includes(`--only=${identifier.slice('lint/'.length)}`) === true,
                    ),
                ))
    )
        return undefined;
    const url = findRulePage(tool, identifier);
    return url === undefined ? undefined : { url };
}

async function readEslintPluginRule(root: string, identifier: string): Promise<unknown> {
    const prefix = extractRulePrefix(identifier);
    if (prefix === undefined) return undefined;
    const plugin = findRulePlugin(prefix);
    const npm = plugin?.installers['npm'];
    if (npm === undefined) return undefined;
    const installed = await importInstalledTool(root, npm.name);
    const exported = findValueAt(installed, ['default']) ?? installed;
    const rules = findValueAt(exported, ['rules']) ?? findValueAt(exported, ['plugin', 'rules']);
    return findValueAt(rules, [identifier.slice(prefix.length + 1)]);
}

function findRulePlugin(prefix: string): Tool | undefined {
    return readConfigurations()
        .values()
        .flatMap((configuration) => configuration.tools)
        .find((pin) => pin.rule_prefix === prefix);
}

function findRulePage(tool: string, rule: string): string | undefined {
    const prefix = extractRulePrefix(rule);
    if (prefix === undefined) {
        const pin = getTool(readConfigurations().values(), tool);
        return pin.rule_url?.replace(RULE_PLACEHOLDER, () => rule);
    }
    const plugin = findRulePlugin(prefix);
    return plugin?.rule_url?.replace(RULE_PLACEHOLDER, () => rule.slice(prefix.length + 1));
}

function readValeRule(root: string, identifier: string): RuleExplanation | undefined {
    if (!VALE_RULE_IDENTIFIER.test(identifier)) return undefined;
    if (!hasValePackages(root)) throw new GspotError('tool', VALE_PACKAGES_MESSAGE);
    for (const folder of [VALE_STYLES_PATH, GSPOT_PATHS.valePackages]) {
        const path = `${folder}/${identifier.replace('.', '/')}.yml`;
        const text = findText(root, path);
        if (text !== undefined) {
            const { message, link } = parseYamlFile(path, text, valeRuleSchema);
            return { description: message.replaceAll('%s', '<text>'), ...(link !== undefined && { url: link }) };
        }
    }
    return undefined;
}

async function readRuffRule(
    root: string,
    identifier: string,
    { timeoutSeconds, help }: RuleToolSearch,
): Promise<RuleExplanation | undefined> {
    const [path] = listRepositoryExecutablePaths(root, 'ruff', { folders: [], toolFolderKind: 'python' });
    if (path === undefined) throw new GspotError('tool', 'Ruff is not installed in .gspot/.venv. Run gspot install.');
    const result = await runTool([path, 'rule', identifier, '--output-format', 'json'], { cwd: root, timeoutSeconds });
    if (result.end !== 'exited') return { fix: help };
    if (result.code !== 0) return undefined;
    const rule = parseJsonFile('ruff rule output', result.stdout, ruffRuleSchema);
    return {
        description: rule.summary.replaceAll(
            RUFF_SUMMARY_FIELD,
            (_, name: string | undefined = 'value') => `<${name}>`,
        ),
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

function getRuleMetadata(rule: unknown, page: string | undefined): RuleExplanation {
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
Tell whether gspot reads this rule of this tool: through a reader of its own, or through the rule page address in its
manifest. Without either, gspot has no list of the rules to explain or to check an ignore against.
*/
export function canReadRuleExplanations(tool: string, rule: string): boolean {
    if (isUnlistedRule(tool, rule)) return false;
    if (RULE_READER_TOOLS.has(tool)) return true;
    return getTool(readConfigurations().values(), tool).rule_url !== undefined;
}

export async function readLintRuleExplanation(
    root: string,
    tool: string,
    identifier: string,
    {
        timeoutSeconds = rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        readMiseBinPaths,
        help,
    }: RuleExplanationOptions,
): Promise<RuleExplanation | undefined> {
    const search = { timeoutSeconds, readMiseBinPaths, help };
    const readRule = new Map<string, () => RuleExplanation | undefined | Promise<RuleExplanation | undefined>>([
        ['ruff', () => readRuffRule(root, identifier, search)],
        ['markdownlint-cli2', () => readMarkdownlintRule(root, identifier)],
        [VALE_TOOL, () => readValeRule(root, identifier)],
        ['swiftlint', () => readSwiftlintRule(root, identifier, search)],
    ]).get(tool);
    if (readRule !== undefined) return readRule();
    if (![ESLINT_MANIFEST_TOOL, STYLELINT_MANIFEST_TOOL].includes(tool))
        return readManifestRuleExplanation(tool, identifier);
    const rule = await readInstalledRule(root, tool, identifier);
    return rule === undefined ? undefined : getRuleMetadata(rule, findRulePage(tool, identifier));
}
