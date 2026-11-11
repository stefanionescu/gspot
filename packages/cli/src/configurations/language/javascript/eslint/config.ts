import { basename, dirname, join, relative } from 'node:path/posix';

import { ESLINT_CHECK, ESLINT_INDENT } from '#cli/config/configurations/eslint/blocks.ts';
import { IMPORT_CYCLES_CONFIG } from '#cli/config/configurations/eslint/rules.ts';
import {
    BOUNDARIES_PLUGIN_PACKAGE,
    CONFIGURATION_BLOCKS_SUFFIX,
    ESLINT_BASE_LABEL,
    ESLINT_CONFIG_API,
    ESLINT_FUNCTIONS_FILE,
    ESLINT_NAMED_IMPORTS,
    ESLINT_PLUGIN_PACKAGES,
    LEVEL_ALL_PLUGIN_PACKAGE,
} from '#cli/config/configurations/javascript.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { convertToGlobs, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';
import { buildBlockLists, buildImportName } from '#cli/configurations/language/javascript/eslint/block-calls.ts';
import { buildClosingBlocks, buildOpeningBlocks } from '#cli/configurations/language/javascript/eslint/blocks/base.ts';
import { buildBoundaryBlocks } from '#cli/configurations/language/javascript/eslint/blocks/boundaries.ts';
import { listConfigurationBlocks } from '#cli/configurations/language/javascript/eslint/blocks/configurations.ts';
import { listLocalPlugins } from '#cli/configurations/language/javascript/eslint/blocks/local-plugins.ts';
import { buildPlannedEslintFile } from '#cli/configurations/language/javascript/eslint/plan.ts';
import { assertRunningRuleOptions } from '#cli/configurations/rule-options.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type {
    BlockWriter,
    ConfigOutput,
    EslintFileWriter,
    PlannedConfig,
    PlannedEslintBlock,
} from '#cli/types/configurations/language.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { GeneratedFile } from '#cli/types/tools.ts';

const UNICORN_PLUGIN_PACKAGE = 'eslint-plugin-unicorn';

const ESLINT_FIXES_FILE = 'fixes.mjs';

function serializeImports(
    { functions, packages, modules, constants }: EslintFileWriter,
    shippedFolder: string,
): string {
    const functionsPath = JSON.stringify(`${shippedFolder}/${ESLINT_FUNCTIONS_FILE}`);
    const fixesPath = JSON.stringify(`${shippedFolder}/${ESLINT_FIXES_FILE}`);
    const lines = functions.size === 0 ? [] : [`import { ${[...functions].join(', ')} } from ${functionsPath};`];
    for (const name of packages) {
        const named = ESLINT_NAMED_IMPORTS[name];
        const importName = named === undefined ? buildImportName(name) : `{ ${named} }`;
        if (name === UNICORN_PLUGIN_PACKAGE)
            lines.push(`import { limitUnicornFixes } from ${fixesPath};`, `const ${importName} = limitUnicornFixes();`);
        else lines.push(`import ${importName} from ${JSON.stringify(name)};`);
    }
    for (const [importName, module] of modules) lines.push(`import ${importName} from ${JSON.stringify(module)};`);
    for (const [name, text] of constants) lines.push(`const ${name} = ${text};`);
    return lines.join('\n') + '\n';
}

function buildConfigurationFiles(
    planned: PlannedConfig,
    blocks: Map<Configuration, PlannedEslintBlock[]>,
    writer: BlockWriter,
): Array<{ importName: string; module: string; file: GeneratedFile }> {
    const folder = dirname(planned.targetPath);
    return [...blocks].map(([configuration, configurationBlocks]) => {
        const path = join(GSPOT_PATHS.configurations, configuration.name, basename(planned.targetPath));
        const fileWriter = {
            ...writer,
            functions: new Set<string>(),
            packages: new Set<string>(),
            modules: new Map<string, string>(),
            constants: new Map<string, string>(),
        };
        const [blockTexts = []] = buildBlockLists(fileWriter, [configurationBlocks]);
        const body = `export default [\n${blockTexts.join(',\n')},\n];\n`;
        return {
            importName: buildImportName(configuration.name) + CONFIGURATION_BLOCKS_SUFFIX,
            module: relative(folder, path),
            file: {
                path,
                content: serializeImports(fileWriter, relative(dirname(path), folder)) + body,
            },
        };
    });
}

function serializeExport(blockTexts: string[], blockWriter: EslintFileWriter): string {
    const configured = blockWriter.ruleOptions.flatMap((options) => Object.keys(options.rules));
    assertRunningRuleOptions({
        configured,
        running: new Set(
            configured.filter((rule) => blockWriter.level === 'all' || !blockWriter.allLevelRules.has(rule)),
        ),
        allLevelRules: blockWriter.allLevelRules,
        level: blockWriter.level,
    });
    blockWriter.packages.add(ESLINT_CONFIG_API);
    const blocks = `defineConfig([\n${blockTexts.join(',\n')},\n])`;
    if (blockWriter.ruleOptions.length === 0) return `export default ${blocks};\n`;
    blockWriter.functions.add('setRuleOptions');
    const ruleOptions = blockWriter.ruleOptions.map((options) => ({
        paths: options.includes.map((path) => [joinScope(escapeGlob(options.scopePath), '**/*'), path]),
        ignores: options.excludes,
        rules: options.rules,
    }));
    return `export default setRuleOptions(${blocks}, ${JSON.stringify(ruleOptions, null, JSON_INDENT)}, ${JSON.stringify(blockWriter.level)});\n`;
}

function buildEslintFile(planned: PlannedConfig): ConfigOutput {
    const { session } = planned;
    const eslintFile = buildPlannedEslintFile(planned);
    const blockWriter = {
        ...eslintFile.blockWriter,
        functions: new Set<string>(),
        packages: new Set<string>(),
        modules: new Map<string, string>(),
        constants: new Map<string, string>(),
    };
    const boundaryBlocks = buildBoundaryBlocks(eslintFile);
    const ignoredGlobs = convertToGlobs([
        ...planned.ignoreSections,
        ...listCheckIgnoreSections(planned.scope.settings, ESLINT_CHECK),
    ]);
    const configurationFiles = buildConfigurationFiles(planned, listConfigurationBlocks(eslintFile), blockWriter);
    const plugins = [
        ...ESLINT_PLUGIN_PACKAGES,
        ...(blockWriter.level === 'all' ? [LEVEL_ALL_PLUGIN_PACKAGE] : []),
        ...(boundaryBlocks.length > 0 ? [BOUNDARIES_PLUGIN_PACKAGE] : []),
    ];
    const localPlugins = listLocalPlugins(
        session.scopes,
        planned.targetPath,
        new Set(plugins.map((name) => blockWriter.rulePrefixes.get(name))),
    );
    const [openingTexts = [], closingTexts = []] = buildBlockLists(
        blockWriter,
        [
            buildOpeningBlocks(eslintFile, { plugins, local: localPlugins }, boundaryBlocks, ignoredGlobs),
            buildClosingBlocks(eslintFile),
        ].map((blocks) => blocks.map((block) => ({ ...block, label: ESLINT_BASE_LABEL }))),
    );
    const blockTexts = [
        `${ESLINT_INDENT}${JSON.stringify({ ignores: ignoredGlobs }, null, JSON_INDENT)}`,
        ...openingTexts,
        ...configurationFiles.map(({ importName }) => `${ESLINT_INDENT}...${importName}`),
        ...closingTexts,
    ];
    const body = serializeExport(blockTexts, blockWriter);
    for (const { importName, module } of configurationFiles) blockWriter.modules.set(importName, module);
    return {
        content: serializeImports(blockWriter, '.') + body,
        companions: configurationFiles.map(({ file }) => file),
    };
}

export const ESLINT_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'javascript/eslint/eslint.mjs': buildEslintFile,
    'javascript/eslint/import-cycles.mjs': () => IMPORT_CYCLES_CONFIG,
};
