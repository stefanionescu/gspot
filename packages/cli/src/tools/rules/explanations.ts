import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import {
    ESLINT_MANIFEST_TOOL,
    RUFF_SUMMARY_FIELD,
    SHELLCHECK_RULE_IDENTIFIER,
    STYLELINT_MANIFEST_TOOL,
    SWIFTLINT_RULE_ARGUMENTS,
    SWIFTLINT_RULE_IDENTIFIER,
    SWIFTLINT_UNKNOWN_RULE,
} from '#cli/config/tools/programs.ts';
import { VALE_PACKAGES_MESSAGE, VALE_RULE_IDENTIFIER, VALE_STYLES_PATH, VALE_TOOL } from '#cli/config/tools/vale.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { findTool } from '#cli/manifests/tools.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { ruffRuleSchema, valeRuleSchema } from '#cli/schemas/tools.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findText } from '#cli/system/files/reads.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { hasValePackages } from '#cli/tools/installers/vale.ts';
import { listExecutablePaths, listRepositoryExecutablePaths } from '#cli/tools/programs/locate.ts';
import { readMarkdownlintRule, readPackageRule } from '#cli/tools/rules/packages.ts';
import { findRulePage, isUnlistedRule } from '#cli/tools/rules/pages.ts';
import { runTool } from '#cli/tools/run.ts';
import type { RuleExplanation, RuleExplanationOptions, RuleToolSearch } from '#cli/types/tools.ts';

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

const RULE_READERS = new Map<
    string,
    (
        root: string,
        identifier: string,
        search: RuleToolSearch,
    ) => RuleExplanation | undefined | Promise<RuleExplanation | undefined>
>([
    ['ruff', readRuffRule],
    ['markdownlint-cli2', readMarkdownlintRule],
    [VALE_TOOL, readValeRule],
    ['swiftlint', readSwiftlintRule],
    [ESLINT_MANIFEST_TOOL, (root, identifier) => readPackageRule(root, ESLINT_MANIFEST_TOOL, identifier)],
    [STYLELINT_MANIFEST_TOOL, (root, identifier) => readPackageRule(root, STYLELINT_MANIFEST_TOOL, identifier)],
]);

/**
Tell whether gspot reads this rule of this tool: through a reader of its own, or through the rule page address in its
manifest. Without either, gspot has no list of the rules to explain or to check an ignore against.
*/
export function canReadRuleExplanations(tool: string, rule: string): boolean {
    if (isUnlistedRule(tool, rule)) return false;
    if (RULE_READERS.has(tool)) return true;
    return findTool(readConfigurations().values(), tool)?.rule_url !== undefined;
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
    const readRule = RULE_READERS.get(tool);
    if (readRule === undefined) return readManifestRuleExplanation(tool, identifier);
    return await readRule(root, identifier, { timeoutSeconds, readMiseBinPaths, help });
}
