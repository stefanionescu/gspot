import ts from 'typescript';
import { JSON_INDENT } from '#cli/config/text.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { join, dirname, basename, relative } from 'node:path/posix';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { assertRuleOptionsRun } from '#cli/generation/config-files/rule-options.ts';
import type { BlockWriter, PlannedEslintBlock } from '#cli/types/generation/eslint.ts';
import { getPreset } from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import { buildRuntimes } from '#cli/generation/configurations/language/javascript/eslint/runtimes.ts';
import type { GeneratedFile, ConfigFileOutput, PlannedConfigFile } from '#cli/types/generation/files.ts';
import { buildPlannedEslintFile } from '#cli/generation/configurations/language/javascript/eslint/plan.ts';
import { splitSettingsBlocks } from '#cli/generation/configurations/language/javascript/eslint/blocks/settings.ts';
import { buildBoundaryBlocks } from '#cli/generation/configurations/language/javascript/eslint/blocks/boundaries.ts';
import { listConfigurationBlocks } from '#cli/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    buildBlockCalls,
    listUnappliedRules,
} from '#cli/generation/configurations/language/javascript/eslint/block-calls.ts';
import {
    convertToGlobs,
    buildIgnoreSections,
    listCheckIgnoreSections,
} from '#cli/generation/config-files/ignore-files.ts';
import {
    listLocalPlugins,
    buildLocalPluginBlocks,
} from '#cli/generation/configurations/language/javascript/eslint/blocks/local-plugins.ts';
import {
    selectPlugins,
    buildClosingBlocks,
    buildOpeningBlocks,
} from '#cli/generation/configurations/language/javascript/eslint/blocks/base.ts';
import {
    NAME_HYPHEN,
    ESLINT_CHECK,
    ESLINT_INDENT,
    GLOBALS_IMPORT,
    ESLINT_FUNCTIONS,
    ESLINT_BASE_LABEL,
    PLUGIN_RECORD_HELP,
    ESLINT_FUNCTIONS_FILE,
    ESLINT_PLUGIN_IMPORTERS,
    IMPORT_NAME_PUNCTUATION,
    CONFIGURATION_BLOCKS_SUFFIX,
    PRESETS_AFTER_CONFIGURATIONS,
    PRESETS_BEFORE_CONFIGURATIONS,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';

function buildConfigurationFiles(
    planned: PlannedConfigFile,
    blocks: Map<Configuration, PlannedEslintBlock[]>,
    imports: (readonly [string, string])[],
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
        const body = `export default [\n${configurationBlocks.map((block) => buildBlockCalls(writer, block)).join(',\n')},\n];\n`;
        return {
            importName:
                configuration.name.replaceAll(NAME_HYPHEN, (_, letter: string) => letter.toUpperCase()) +
                CONFIGURATION_BLOCKS_SUFFIX,
            module: relative(folder, path),
            file: {
                path,
                content:
                    serializeImports(body, imports, relative(dirname(path), join(folder, ESLINT_FUNCTIONS_FILE))) +
                    body,
            },
        };
    });
}

/**
Build the eslint.mjs of a configuration: its imports, and the calls of the shipped functions that build
its blocks.

@param planned the config file to build.
*/
export function buildEslintFile(planned: PlannedConfigFile): ConfigFileOutput {
    const { session } = planned;
    const eslintFile = buildPlannedEslintFile(planned);
    const { blockWriter } = eslintFile;
    const runtimes = buildRuntimes(session.scopes);
    blockWriter.runtimes = runtimes;
    const boundaryBlocks = buildBoundaryBlocks(eslintFile);
    const ignoredGlobs = convertToGlobs([
        ...buildIgnoreSections(planned.session),
        ...listCheckIgnoreSections(planned.scope.settings, ESLINT_CHECK),
    ]);
    const { configurationBlocks, configurationImports } = listConfigurationBlocks(eslintFile);
    const shipped = selectPlugins(eslintFile, boundaryBlocks);
    const plugins = { ...shipped, ...listLocalPlugins(session.scopes, planned.targetPath, shipped) };
    const presets = eslintFile.eslintPresets.get(JAVASCRIPT_CONFIGURATION);
    const imports = [
        GLOBALS_IMPORT,

        ...[...PRESETS_BEFORE_CONFIGURATIONS, ...PRESETS_AFTER_CONFIGURATIONS].map(
            ([name, importName]) => [importName, getPreset(presets, name).package] as const,
        ),
        ...Object.values(plugins),
        ...Object.values(configurationImports),
    ];
    const configurationFiles = buildConfigurationFiles(planned, configurationBlocks, imports, blockWriter);
    const blockTexts = [
        `${ESLINT_INDENT}buildBlock(${JSON.stringify({ ignores: ignoredGlobs }, null, JSON_INDENT)})`,
        ...buildOpeningBlocks(eslintFile, plugins, boundaryBlocks, ignoredGlobs).map((block) =>
            buildBlockCalls(blockWriter, { ...block, label: ESLINT_BASE_LABEL }),
        ),
        ...configurationFiles.map(({ importName }) => `${ESLINT_INDENT}...${importName}`),
        ...[
            ...buildClosingBlocks(eslintFile, runtimes),
            ...[
                ...splitSettingsBlocks(eslintFile),
                ...buildLocalPluginBlocks(session.scopes, eslintFile.eslintFiles.code),
            ].map((fields) => ({ fields })),
        ].map((block) => buildBlockCalls(blockWriter, { ...block, label: ESLINT_BASE_LABEL })),
    ];
    const body = `export default [\n${blockTexts.join(',\n')},\n];\n`;
    assertRuleOptionsRun({
        configured: listUnappliedRules(blockWriter),
        running: blockWriter.applied,
        allLevelRules: blockWriter.allLevelRules,
        level: blockWriter.level,
        suffix: PLUGIN_RECORD_HELP,
    });
    return {
        content:
            serializeImports(
                body,
                [...imports, ...configurationFiles.map(({ importName, module }) => [importName, module] as const)],
                `./${ESLINT_FUNCTIONS_FILE}`,
            ) + body,
        companions: configurationFiles.map(({ file }) => file),
    };
}

function listReadNames(text: string): Set<string> {
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
        const isKey =
            (ts.isPropertyAssignment(node.parent) || ts.isPropertyAccessExpression(node.parent)) &&
            node.parent.name === node;
        if (!isKey && ts.isIdentifier(node)) names.add(node.text);
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(ts.createSourceFile('eslint.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), visit);
    return names;
}

function serializeImports(
    text: string,
    imports: readonly (readonly [string, string])[],
    functionsPath: string,
): string {
    const read = listReadNames(text);
    const selected = new Map(imports.map((pair) => [JSON.stringify(pair), pair]))
        .values()
        .filter(([name]) =>
            name
                .replaceAll(IMPORT_NAME_PUNCTUATION, '')
                .split(',')
                .some((importedName) => read.has(importedName)),
        )
        .toArray();
    const functions = [
        ...new Set([
            ...ESLINT_FUNCTIONS.filter((name) => read.has(name)),
            ...selected.flatMap(([, source]) => {
                const importer = ESLINT_PLUGIN_IMPORTERS.get(source);
                return importer === undefined ? [] : importer;
            }),
        ]),
    ];
    const lines =
        functions.length === 0 ? [] : [`import { ${functions.join(', ')} } from ${JSON.stringify(functionsPath)};`];
    for (const [importName, source] of selected) {
        if (!ESLINT_PLUGIN_IMPORTERS.has(source)) lines.push(`import ${importName} from ${JSON.stringify(source)};`);
    }
    return lines.join('\n') + '\n';
}
