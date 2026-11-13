import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import {
    ESLINT_BUILTIN_RULES,
    ESLINT_MANIFEST_TOOL,
    INSTALL_FOR_RULES_MESSAGE,
    MARKDOWNLINT_RULE_DESCRIPTION,
    MARKDOWNLINT_RULE_SCHEMA,
    STYLELINT_MANIFEST_TOOL,
    UNDEFINED_NAME_FIX,
} from '#cli/config/tools/rules.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { installedRulesSchema, ruleDocumentationSchema } from '#cli/schemas/tools.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isInside } from '#cli/system/paths.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { extractRulePrefix, findRulePage, findRulePlugin } from '#cli/tools/rules/pages.ts';
import type { RuleExplanation } from '#cli/types/tools.ts';

function findInstalledToolPath(root: string, specifier: string, subpath?: string): string | undefined {
    let path: string | undefined;
    try {
        path = createRequire(join(root, GSPOT_PATHS.npmProject)).resolve(specifier);
    } catch (error) {
        if (!hasErrorCode(error, 'MODULE_NOT_FOUND') && !hasErrorCode(error, 'ERR_PACKAGE_PATH_NOT_EXPORTED'))
            throw error;
        path = findImportEntry(root, specifier);
    }
    if (path === undefined) return undefined;
    assertInstalledPath(root, specifier, path);
    if (subpath === undefined) return path;
    const target = resolve(dirname(path), subpath);
    assertInstalledPath(root, specifier, target);
    return target;
}

/**
Find the root entry of an installed package that `require` cannot resolve, because its `exports` name the entry under
`import` or `default` only.
*/
function findImportEntry(root: string, name: string): string | undefined {
    const manifest = `${GSPOT_PATHS.nodeModules}/${name}/package.json`;
    const text = findText(root, manifest);
    if (text === undefined) return undefined;
    const entry = findValueAt(parseJsonFile(manifest, text), ['exports', '.']);
    const target = findValueAt(entry, ['import']) ?? findValueAt(entry, ['default']);
    return typeof target === 'string' ? join(root, GSPOT_PATHS.nodeModules, name, target) : undefined;
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
    if (rule === null || (typeof rule !== 'object' && typeof rule !== 'function'))
        throw new TypeError('The installed rule has no implementation.');
    const metadata = ruleDocumentationSchema.default({}).parse(Reflect.get(rule, 'meta'));
    const docs = { ...metadata.docs };
    const url = metadata.url ?? page;
    if (url !== undefined && docs.url === undefined) docs.url = url;
    return docs;
}

export function readMarkdownlintRule(root: string, identifier: string): RuleExplanation | undefined {
    const path = findInstalledToolPath(root, 'markdownlint', MARKDOWNLINT_RULE_SCHEMA);
    if (path === undefined) throw new GspotError('tool', 'Markdownlint is not installed. Run gspot install.');
    const ruleTable = parseJsonFile('markdownlint rule catalog', readFileSync(path, 'utf8'), installedRulesSchema);
    const match = MARKDOWNLINT_RULE_DESCRIPTION.exec(ruleTable.properties[identifier]?.description ?? '');
    const description = match?.[1];
    const url = match?.[2];
    return description === undefined || url === undefined ? undefined : { description, url };
}

export async function readPackageRule(
    root: string,
    tool: string,
    identifier: string,
): Promise<RuleExplanation | undefined> {
    const rule = await readInstalledRule(root, tool, identifier);
    if (rule === undefined) return undefined;
    const docs = getRuleMetadata(rule, findRulePage(tool, identifier));
    return tool === ESLINT_MANIFEST_TOOL && identifier === 'no-undef' ? { fix: UNDEFINED_NAME_FIX, ...docs } : docs;
}
