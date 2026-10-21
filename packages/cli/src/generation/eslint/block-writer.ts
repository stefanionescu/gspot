import { buildScopeGlob, buildScopeFiles } from '#cli/generation/eslint/files.ts';
import { serializeBlock, indentEslintBlock } from '#cli/generation/eslint/print.ts';

import type {
    BlockWriter,
    EslintBlockFields,
    PlannedEslintBlock,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

// Your own options apply only to rules that this block already enables. Each applied rule joins the applied set.
function buildOptionBlocks(
    block: EslintBlockFields & { rules: Record<string, unknown> },
    writer: BlockWriter,
): EslintBlockFields[] {
    return writer.ruleOptions.flatMap((options): EslintBlockFields[] => {
        const entries = Object.entries(block.rules).flatMap(([name, value]): [string, unknown][] => {
            const chosen = options.rules[name];
            const severity: unknown = Array.isArray(value) ? value[0] : value;
            return chosen === undefined || severity === 'off' || severity === 0 ? [] : [[name, [severity, ...chosen]]];
        });
        for (const [name] of entries) writer.applied.add(name);
        if (entries.length === 0) return [];
        return [
            {
                ...block,
                files: buildScopeFiles(block.files ?? writer.codeFiles, options.scope, options.includes),
                ignores: [...(block.ignores ?? []), ...options.excludes],
                rules: Object.fromEntries<unknown>(entries),
            },
        ];
    });
}

// Preset syntax belongs to the first block; option blocks retain only their own rules.
function formatBlocks(blocks: EslintBlockFields[], planned: PlannedEslintBlock, level: BlockWriter['level']): string {
    return blocks
        .map((entry, index) => {
            let runtimeText = '';
            let selectedPreset: EslintRuleExpression | undefined;
            let note = planned.label;
            if (index === 0) {
                runtimeText = planned.properties ?? '';
                selectedPreset = planned.preset;
                if (planned.preset !== undefined) note += ': ' + planned.preset.expression;
            } else note += ': your own rule options';
            const source = serializeBlock(entry, {
                properties: runtimeText,
                preset: selectedPreset,
                level: planned.scope === undefined ? level : undefined,
            });
            const value = planned.scope === undefined ? source : `stripRuntimeGlobals(${source}, globals)`;
            return indentEslintBlock(`// ${note}\n${value}`);
        })
        .join(',\n');
}

/**
 * Print a block and record the rule options it applies.
 *
 * @param writer the file's rule options and shared applied set.
 * @param block the block, its scope, and its label.
 * @returns the serialized block and any applicable option blocks.
 */
function writeEslintBlock(writer: BlockWriter, block: PlannedEslintBlock): string {
    const { allLevelRules, level, codeFiles } = writer;
    const { data: payload, scope } = block;
    const rules: Record<string, unknown> = Object.fromEntries(
        (payload.rules === undefined ? [] : Object.entries(payload.rules)).map(([name, value]) => [
            name,
            level !== 'all' && allLevelRules.has(name) ? 'off' : value,
        ]),
    );
    const nested =
        scope === undefined
            ? {}
            : {
                  files: (payload.files ?? codeFiles).map((entry) => [
                      ...(Array.isArray(entry) ? entry : [entry]),
                      buildScopeGlob(scope.path, '**/*'),
                  ]),
                  ignores: [...(payload.ignores ?? []), ...scope.excluded],
              };
    const fields = { ...payload, ...nested, rules };
    return formatBlocks([fields, ...buildOptionBlocks(fields, writer)], block, level);
}

/**
 * List your rule options that no enabled block accepted.
 *
 * @param writer the options and the shared applied set.
 * @returns the unapplied rule names.
 */
export function listUnappliedRules(writer: BlockWriter): string[] {
    return [
        ...new Set(
            writer.ruleOptions
                .flatMap((options) => Object.keys(options.rules))
                .filter((rule) => !writer.applied.has(rule)),
        ),
    ];
}

/**
 * Serialize the blocks in order with the block writer of the scope.
 *
 * @param writer the shared rule options and applied set.
 * @param blocks the block arguments, in order.
 *
 * @returns the serialized ESLint blocks.
 */
export function serializeBlocks(writer: BlockWriter, blocks: PlannedEslintBlock[]): string {
    return blocks.map((block) => writeEslintBlock(writer, block)).join(',\n');
}
