import { JSON_INDENT } from '#cli/config/text.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { ESLINT_INDENT } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import { PRESET_IMPORTERS } from '#cli/config/generation/configurations/language/javascript/eslint/block-calls.ts';
import { GSPOT_PRESET_LEVELS } from '#cli/config/generation/configurations/language/javascript/eslint/blocks/base.ts';

import {
    type BlockWriter,
    type EslintRuntime,
    type EslintBlockFields,
    type EslintCallArgument,
    type PlannedEslintBlock,
} from '#cli/types/generation/eslint.ts';

function serializePresetImport(importName: string, path?: string): string {
    const importer = PRESET_IMPORTERS[importName];
    const value = importer === undefined ? importName : `${importer}()`;
    return path === undefined ? value : `readPreset(${value}, ${JSON.stringify(path)})`;
}

function serializeArgument(argument: EslintCallArgument): string {
    if ('value' in argument) return JSON.stringify(argument.value, null, JSON_INDENT);
    if ('importName' in argument) return serializePresetImport(argument.importName, argument.path);
    return `{ ${Object.entries(argument.imports)
        .map(
            ([name, importName]) =>
                `${JSON.stringify(name)}: ${typeof importName === 'string' ? serializePresetImport(importName) : serializePresetImport(importName[0], importName[1])}`,
        )
        .join(', ')} }`;
}

function serializeFields(block: EslintBlockFields, runtimes: EslintRuntime[]): string {
    const { files, ...fields } = block;
    const members = Object.entries(fields).map(
        ([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value, null, JSON_INDENT)}`,
    );
    if (files !== undefined) {
        const matcher = (value: (typeof files)[number]): string => {
            if (Array.isArray(value)) return `[${value.map((pattern) => matcher(pattern)).join(', ')}]`;
            if (typeof value === 'string') return JSON.stringify(value);
            if ('runtime' in value)
                return `buildRuntimeMatcher(${String(value.runtime)}, ${JSON.stringify(runtimes, null, JSON_INDENT)})`;
            return value.component === 'vue'
                ? 'buildComponentMatcher(vueParser)'
                : 'buildComponentMatcher(importSvelteParser(), readPreset(tseslint, "parser"))';
        };
        members.push(`"files": [${files.map((pattern) => matcher(pattern)).join(', ')}]`);
    }
    return `{${members.join(',\n')}}`;
}

function wrapBlockCalls(source: string, planned: PlannedEslintBlock, options: BlockWriter): string {
    let value = source;
    for (const preset of (planned.presets ?? []).toReversed()) {
        value = `${preset.merge === 'fields' ? 'mergePreset' : 'mergePresetRules'}(${value}, ${serializePresetImport(preset.importName)}, ${JSON.stringify(preset.path)})`;
    }
    if (planned.scope === undefined)
        value = `setLevelRules(${value}, gspot, ${JSON.stringify(GSPOT_PRESET_LEVELS[options.level])})`;
    for (const call of planned.calls ?? []) {
        const args = [value, ...call.args.map((argument) => serializeArgument(argument))];
        value = `${call.name}(${args.join(', ')})`;
    }
    return value;
}

function buildScopeFields(blockWriter: BlockWriter, block: PlannedEslintBlock): EslintBlockFields {
    const { fields, scope } = block;
    const { ignores: _ignores, ...blockFields } = fields;
    const ignores = [...(fields.ignores ?? []), ...(scope?.excluded ?? [])];
    return {
        ...blockFields,
        ...(scope !== undefined && {
            files: (fields.files ?? blockWriter.codeFiles).map((pattern) => [
                ...(Array.isArray(pattern) ? pattern : [pattern]),
                joinScope(escapeGlob(scope.path), '**/*'),
            ]),
        }),
        ...(ignores.length > 0 && { ignores }),
    };
}

/**
Print a block: its fields, the presets under it, and the calls that finish it. A preset list prints one block per config.

@param blockWriter the level, the code files, and the runtimes of the file.
@param block the block, its scope, and its label.
@returns the serialized block.
*/
export function buildBlockCalls(blockWriter: BlockWriter, block: PlannedEslintBlock): string {
    const source = `buildBlock(${serializeFields(buildScopeFields(blockWriter, block), blockWriter.runtimes ?? [])})`;
    const spread = block.presets?.find((preset) => preset.merge === 'spread');
    let value: string;
    if (spread === undefined) {
        const calls = wrapBlockCalls(source, block, blockWriter);
        value = block.scope === undefined ? calls : `stripRuntimeGlobals(${calls}, globals)`;
    } else {
        const scopeFiles = JSON.stringify(joinScope(escapeGlob(block.scope?.path ?? ''), '**/*'));
        value = `...spreadPreset(${source}, ${serializePresetImport(spread.importName)}, ${JSON.stringify(spread.path)}, { files: ${scopeFiles}, globals })`;
    }
    return value
        .split('\n')
        .map((line) => ESLINT_INDENT + line)
        .join('\n');
}
