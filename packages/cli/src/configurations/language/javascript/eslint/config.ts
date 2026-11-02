import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { GeneratedFile } from '#cli/types/tools.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { join, dirname, basename, relative } from 'node:path/posix';
import { refuseIdleRuleOptions } from '#cli/configurations/rule-options.ts';
import { ESLINT_CHECK, ESLINT_INDENT } from '#cli/config/configurations/blocks.ts';
import { convertToGlobs, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';
import { buildPlannedEslintFile } from '#cli/configurations/language/javascript/eslint/plan.ts';
import { splitSettingsBlocks } from '#cli/configurations/language/javascript/eslint/blocks/settings.ts';
import { buildBoundaryBlocks } from '#cli/configurations/language/javascript/eslint/blocks/boundaries.ts';
import { buildImportName, buildBlockCalls } from '#cli/configurations/language/javascript/eslint/block-calls.ts';
import { listConfigurationBlocks } from '#cli/configurations/language/javascript/eslint/configuration-blocks.ts';
import { buildClosingBlocks, buildOpeningBlocks } from '#cli/configurations/language/javascript/eslint/blocks/base.ts';

import {
    listLocalPlugins,
    buildLocalPluginBlocks,
} from '#cli/configurations/language/javascript/eslint/blocks/local-plugins.ts';
import type {
    BlockWriter,
    ConfigOutput,
    PlannedConfig,
    EslintFileWriter,
    PlannedEslintBlock,
} from '#cli/types/configurations/language.ts';
import {
    ESLINT_BASE_LABEL,
    ESLINT_CONFIG_API,
    ESLINT_NAMED_IMPORTS,
    ESLINT_FUNCTIONS_FILE,
    ESLINT_PLUGIN_PACKAGES,
    LEVEL_ALL_PLUGIN_PACKAGE,
    BOUNDARIES_PLUGIN_PACKAGE,
    CONFIGURATION_BLOCKS_SUFFIX,
} from '#cli/config/configurations/javascript.ts';

function serializeImports({ functions, packages, modules }: EslintFileWriter, functionsPath: string): string {
    const lines =
        functions.size === 0 ? [] : [`import { ${[...functions].join(', ')} } from ${JSON.stringify(functionsPath)};`];
    for (const name of packages) {
        const named = ESLINT_NAMED_IMPORTS[name];
        const importName = named === undefined ? buildImportName(name) : `{ ${named} }`;
        lines.push(`import ${importName} from ${JSON.stringify(name)};`);
    }
    for (const [importName, module] of modules) lines.push(`import ${importName} from ${JSON.stringify(module)};`);
    return lines.join('\n') + '\n';
}

function buildConfigurationFiles(
    planned: PlannedConfig,
    blocks: Map<Configuration, PlannedEslintBlock[]>,
    writer: BlockWriter,
): { importName: string; module: string; file: GeneratedFile }[] {
    const folder = dirname(planned.targetPath);
    return [...blocks].map(([configuration, configurationBlocks]) => {
        const path = join(
            GSPOT_PATHS.configurations,
            configuration.group,
            configuration.name,
            basename(planned.targetPath),
        );
        const fileWriter = { ...writer, functions: new Set<string>(), packages: new Set<string>(), modules: new Map() };
        const body = `export default [\n${configurationBlocks.map((block) => buildBlockCalls(fileWriter, block)).join(',\n')},\n];\n`;
        return {
            importName: buildImportName(configuration.name) + CONFIGURATION_BLOCKS_SUFFIX,
            module: relative(folder, path),
            file: {
                path,
                content:
                    serializeImports(fileWriter, relative(dirname(path), join(folder, ESLINT_FUNCTIONS_FILE))) + body,
            },
        };
    });
}

function serializeExport(blockTexts: string[], blockWriter: EslintFileWriter): string {
    const configured = blockWriter.ruleOptions.flatMap((options) => Object.keys(options.rules));
    refuseIdleRuleOptions({
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
        paths: options.includes.map((path) => [joinScope(escapeGlob(options.scope), '**/*'), path]),
        ignores: options.excludes,
        rules: options.rules,
    }));
    return `export default setRuleOptions(${blocks}, ${JSON.stringify(ruleOptions, null, JSON_INDENT)});\n`;
}

/**
Build the eslint.mjs of a configuration: its imports, and the calls of the shipped functions that build
its blocks.

@param planned the config file to build.
*/
export function buildEslintFile(planned: PlannedConfig): ConfigOutput {
    const { session } = planned;
    const eslintFile = buildPlannedEslintFile(planned);
    const blockWriter = {
        ...eslintFile.blockWriter,
        functions: new Set<string>(),
        packages: new Set<string>(),
        modules: new Map<string, string>(),
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
    const blockTexts = [
        `${ESLINT_INDENT}${JSON.stringify({ ignores: ignoredGlobs }, null, JSON_INDENT)}`,
        ...buildOpeningBlocks(eslintFile, { plugins, local: localPlugins }, boundaryBlocks, ignoredGlobs).map((block) =>
            buildBlockCalls(blockWriter, { ...block, label: ESLINT_BASE_LABEL }),
        ),
        ...configurationFiles.map(({ importName }) => `${ESLINT_INDENT}...${importName}`),
        ...[
            ...buildClosingBlocks(eslintFile, blockWriter.runtimes),
            ...[
                ...splitSettingsBlocks(eslintFile),
                ...buildLocalPluginBlocks(session.scopes, eslintFile.eslintFiles.code),
            ].map((fields) => ({ fields })),
            ...(blockWriter.level === 'all'
                ? []
                : [
                      {
                          fields: {
                              rules: Object.fromEntries([...blockWriter.allLevelRules].map((rule) => [rule, 'off'])),
                          },
                      },
                  ]),
        ].map((block) => buildBlockCalls(blockWriter, { ...block, label: ESLINT_BASE_LABEL })),
    ];
    const body = serializeExport(blockTexts, blockWriter);
    for (const { importName, module } of configurationFiles) blockWriter.modules.set(importName, module);
    return {
        content: serializeImports(blockWriter, `./${ESLINT_FUNCTIONS_FILE}`) + body,
        companions: configurationFiles.map(({ file }) => file),
    };
}
