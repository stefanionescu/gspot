import { JSON_INDENT } from '#cli/config/text.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { join, dirname, basename, relative } from 'node:path/posix';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { assertRuleOptionsRun } from '#cli/generation/config-files/rule-options.ts';
import type { BlockWriter, PlannedEslintBlock } from '#cli/types/generation/eslint.ts';
import { getPreset } from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import { convertToGlobs, listIgnoreSections } from '#cli/generation/config-files/ignore-files.ts';
import { buildRuntimes } from '#cli/generation/configurations/language/javascript/eslint/runtimes.ts';
import type { GeneratedFile, ConfigFileOutput, PlannedConfigFile } from '#cli/types/generation/files.ts';
import { buildPlannedEslintFile } from '#cli/generation/configurations/language/javascript/eslint/plan.ts';
import { buildSelectedBlocks } from '#cli/generation/configurations/language/javascript/eslint/blocks/settings.ts';
import { buildBoundaryBlocks } from '#cli/generation/configurations/language/javascript/eslint/blocks/boundaries.ts';
import { serializeBlock, serializeImports } from '#cli/generation/configurations/language/javascript/eslint/print.ts';
import { listConfigurationBlocks } from '#cli/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    writeEslintBlock,
    listUnappliedRules,
} from '#cli/generation/configurations/language/javascript/eslint/block-writer.ts';
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
    PATH_JOIN_IMPORT,
    ESLINT_BASE_LABEL,
    RUNTIME_DECLARATIONS,
    ESLINT_FUNCTIONS_FILE,
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
        const body = `export default [\n${configurationBlocks.map((block) => writeEslintBlock(writer, block)).join(',\n')},\n];\n`;
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
Build the main ESLint config file and the ESLint config file of each configuration that adds blocks. The main file
holds the ignores and the blocks of the repository, and spreads the blocks of each configuration in plan order.

@param planned the config file with its scope, level, and target path.
@returns the JavaScript text of the main file, and the file of each configuration.
*/
export function buildEslintFile(planned: PlannedConfigFile): ConfigFileOutput {
    const { session } = planned;
    const eslintFile = buildPlannedEslintFile(planned);
    const { blockWriter } = eslintFile;
    const runtimes = buildRuntimes(session.scopes);
    const boundaryBlocks = buildBoundaryBlocks(eslintFile);
    const ignoredGlobs = convertToGlobs(listIgnoreSections(planned, ESLINT_CHECK));
    const { configurationBlocks, configurationImports, configurationSelectors } = listConfigurationBlocks(eslintFile);
    const shipped = selectPlugins(eslintFile, boundaryBlocks);
    const plugins = { ...shipped, ...listLocalPlugins(session.scopes, planned.targetPath, shipped) };
    const presets = eslintFile.eslintPresets.get(JAVASCRIPT_CONFIGURATION);
    const imports = [
        GLOBALS_IMPORT,
        PATH_JOIN_IMPORT,
        ...[...PRESETS_BEFORE_CONFIGURATIONS, ...PRESETS_AFTER_CONFIGURATIONS].map(
            ([name, importName]) => [importName, getPreset(presets, name).package] as const,
        ),
        ...Object.values(plugins),
        ...Object.values(configurationImports),
    ];
    const configurationFiles = buildConfigurationFiles(planned, configurationBlocks, imports, blockWriter);
    const blockTexts = [
        ['// Files that ESLint skips.', ...serializeBlock({ ignores: ignoredGlobs }).split('\n')]
            .map((line) => ESLINT_INDENT + line)
            .join('\n'),
        ...buildOpeningBlocks(eslintFile, plugins, boundaryBlocks, ignoredGlobs).map((block) =>
            writeEslintBlock(blockWriter, { ...block, label: ESLINT_BASE_LABEL }),
        ),
        ...configurationFiles.map(({ importName }) => `${ESLINT_INDENT}...${importName}`),
        ...[
            ...buildClosingBlocks(eslintFile, configurationSelectors, runtimes),
            ...[
                ...buildSelectedBlocks(eslintFile),
                ...buildLocalPluginBlocks(session.scopes, eslintFile.eslintFiles.code),
            ].map((fields) => ({ fields })),
        ].map((block) => writeEslintBlock(blockWriter, { ...block, label: ESLINT_BASE_LABEL })),
    ];
    const body = `export default [\n${blockTexts.join(',\n')},\n];\n`;
    const declarations = body.includes(RUNTIME_DECLARATIONS)
        ? `const ${RUNTIME_DECLARATIONS} = ${JSON.stringify(runtimes, null, JSON_INDENT)};\n`
        : '';
    assertRulesRun(blockWriter);
    return {
        content:
            serializeImports(
                declarations + body,
                [...imports, ...configurationFiles.map(({ importName, module }) => [importName, module] as const)],
                `./${ESLINT_FUNCTIONS_FILE}`,
            ) +
            declarations +
            body,
        companions: configurationFiles.map(({ file }) => file),
    };
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function assertRulesRun(writer: BlockWriter): void {
    assertRuleOptionsRun({
        chosen: listUnappliedRules(writer),
        running: writer.applied,
        higher: writer.allLevelRules,
        level: writer.level,
        suffix: ' For a rule of your own, add a [[tools.eslint.plugins]] record.',
    });
}
