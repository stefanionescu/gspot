import { isDeepStrictEqual } from 'node:util';
import { JSON_INDENT } from '#cli/config/text.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { buildScopeFiles } from '#cli/generation/configurations/language/javascript/eslint/files.ts';
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

function buildOptionBlocks(
    block: EslintBlockFields & { rules: Record<string, unknown> },
    blockOptions: BlockWriter,
): EslintBlockFields[] {
    return blockOptions.ruleOptions.flatMap((options): EslintBlockFields[] => {
        const pickedRules = Object.entries(block.rules).flatMap(([name, value]): [string, unknown][] => {
            const override = options.rules[name];
            const severity: unknown = Array.isArray(value) ? value[0] : value;
            return override === undefined || severity === 'off' || severity === 0
                ? []
                : [[name, [severity, ...override]]];
        });
        for (const [name] of pickedRules) blockOptions.applied.add(name);
        if (pickedRules.length === 0) return [];
        return [
            {
                ...block,
                files: buildScopeFiles(block.files ?? blockOptions.codeFiles, options.scope, options.includes),
                ignores: [...(block.ignores ?? []), ...options.excludes],
                rules: Object.fromEntries<unknown>(pickedRules),
            },
        ];
    });
}

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

function serializeBlockFields(block: EslintBlockFields, planned: PlannedEslintBlock, options: BlockWriter): string {
    const { ignores, rules, ...fields } = block;
    const preset = planned.preset;
    const rulePairs = rules === undefined ? [] : Object.entries(rules);
    const changed =
        preset === undefined
            ? rules
            : Object.fromEntries(rulePairs.filter(([name, value]) => !isDeepStrictEqual(value, preset.rules?.[name])));
    const printed = {
        ...fields,
        ...(ignores !== undefined && ignores.length > 0 && { ignores }),
        ...(changed !== undefined && { rules: changed }),
    };
    return `buildBlock(${serializeFields(printed, options.runtimes ?? [])})`;
}

function wrapBlockCalls(source: string, planned: PlannedEslintBlock, options: BlockWriter): string {
    let value = source;
    for (const preset of (planned.preset?.sources ?? []).toReversed()) {
        value = `${preset.includeFields === true ? 'mergePreset' : 'mergePresetRules'}(${value}, ${serializePresetImport(preset.importName)}, ${JSON.stringify(preset.path)})`;
    }
    if (planned.scope === undefined)
        value = `setLevelRules(${value}, gspot, ${JSON.stringify(GSPOT_PRESET_LEVELS[options.level])})`;
    for (const call of planned.calls ?? []) {
        const args = [value, ...call.args.map((argument) => serializeArgument(argument))];
        value = `${call.name}(${args.join(', ')})`;
    }
    return value;
}

function formatBlocks(blocks: EslintBlockFields[], planned: PlannedEslintBlock, options: BlockWriter): string {
    return blocks
        .map((block, index) => {
            const selected =
                index === 0
                    ? planned
                    : {
                          label: planned.label,
                          fields: block,
                          ...(planned.scope === undefined ? {} : { scope: planned.scope }),
                      };
            const source = serializeBlockFields(block, selected, options);
            const calls = wrapBlockCalls(source, selected, options);
            const value = selected.scope === undefined ? calls : `stripRuntimeGlobals(${calls}, globals)`;
            return value
                .split('\n')
                .map((line) => ESLINT_INDENT + line)
                .join('\n');
        })
        .join(',\n');
}

/**
Print a block and record the rule options it applies.

@param blockOptions the file's rule options and shared applied set.
@param block the block, its scope, and its label.
@returns the serialized block and any applicable option blocks.
*/
export function buildBlockCalls(blockOptions: BlockWriter, block: PlannedEslintBlock): string {
    const { allLevelRules, level, codeFiles } = blockOptions;
    const { fields: blockFields, scope } = block;
    const rules: Record<string, unknown> = Object.fromEntries(
        (blockFields.rules === undefined ? [] : Object.entries(blockFields.rules)).map(([name, value]) => [
            name,
            level !== 'all' && allLevelRules.has(name) ? 'off' : value,
        ]),
    );
    const ignores = [...(blockFields.ignores ?? []), ...(scope?.excluded ?? [])];
    const nested =
        scope === undefined
            ? {}
            : {
                  files: (blockFields.files ?? codeFiles).map((pattern) => [
                      ...(Array.isArray(pattern) ? pattern : [pattern]),
                      joinScope(escapeGlob(scope.path), '**/*'),
                  ]),
                  ...(ignores.length > 0 && { ignores }),
              };
    const fields = { ...blockFields, ...nested, rules };
    return formatBlocks([fields, ...buildOptionBlocks(fields, blockOptions)], block, blockOptions);
}

/**
List your rule options that no enabled block accepted.

@param blockOptions the options and the shared applied set.
*/
export function listUnappliedRules(blockOptions: BlockWriter): string[] {
    return [
        ...new Set(
            blockOptions.ruleOptions
                .flatMap((options) => Object.keys(options.rules))
                .filter((rule) => !blockOptions.applied.has(rule)),
        ),
    ];
}
