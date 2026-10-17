import { joinScope } from '#cli/repository/scopes.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { buildScopeFiles } from '#cli/generation/eslint/files.ts';
import { serializeBlock, indentEslintBlock } from '#cli/generation/eslint/print.ts';

import type {
    BlockWriter,
    BlockWriterInput,
    EslintSettingsBlock,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

// Your own options apply only to rules that this block already enables.
function buildOptionBlocks(
    block: EslintSettingsBlock & { rules: Record<string, unknown> },
    input: BlockWriterInput,
): EslintSettingsBlock[] {
    return input.ruleOptions.flatMap((options): EslintSettingsBlock[] => {
        const entries = Object.entries(block.rules).flatMap(([name, value]): [string, unknown][] => {
            const chosen = options.rules[name];
            const severity: unknown = Array.isArray(value) ? value[0] : value;
            return chosen === undefined || severity === 'off' || severity === 0 ? [] : [[name, [severity, ...chosen]]];
        });
        if (entries.length === 0) return [];
        return [
            {
                ...block,
                files: buildScopeFiles(block.files ?? input.codeFiles, options.scope, options.includes),
                ignores: [...(block.ignores ?? []), ...options.excludes],
                rules: Object.fromEntries<unknown>(entries),
            },
        ];
    });
}

// Preset syntax belongs to the first block; option blocks retain only their own rules.
function formatBlocks(
    blocks: EslintSettingsBlock[],
    input: BlockWriterInput,
    runtime: string | undefined,
    preset: EslintRuleExpression | undefined,
): string {
    const level = input.isAll ? 'all' : 'recommended';
    return blocks
        .map((entry, index) => {
            let runtimeText = '';
            let selectedPreset: EslintRuleExpression | undefined;
            let note = input.source;
            if (index === 0) {
                runtimeText = runtime ?? '';
                selectedPreset = preset;
                if (preset !== undefined) note += ': ' + preset.expression;
            } else note += ': your own rule options';
            const source = serializeBlock(
                entry,
                runtimeText,
                selectedPreset,
                input.scope === undefined ? level : undefined,
            );
            const value = input.scope === undefined ? source : `stripRuntimeGlobals(${source}, globals)`;
            return indentEslintBlock(`// ${note}\n${value}`);
        })
        .join(',\n');
}

/**
 * Create the writer for the ESLint blocks of one level and scope.
 * @param input what the blocks cover, with your own options.
 * @returns the functions that format each ESLint block.
 */
function createBlockWriter(input: BlockWriterInput): BlockWriter {
    const { allRules, isAll, codeFiles, scope } = input;
    return {
        block: (payload, runtime, preset) => {
            const rules: Record<string, unknown> = Object.fromEntries(
                (payload.rules === undefined ? [] : Object.entries(payload.rules)).map(([name, value]) => [
                    name,
                    !isAll && allRules.has(name) ? 'off' : value,
                ]),
            );
            const nested =
                scope === undefined
                    ? {}
                    : {
                          files: (payload.files ?? codeFiles).map((entry) => [
                              ...(Array.isArray(entry) ? entry : [entry]),
                              joinScope(escapeGlob(scope.path), '**/*'),
                          ]),
                          ignores: [...(payload.ignores ?? []), ...scope.excluded],
                      };
            const block = { ...payload, ...nested, rules };
            return formatBlocks([block, ...buildOptionBlocks(block, input)], input, runtime, preset);
        },
    };
}

/**
 * Turn enabled warnings into errors, and keep every preset option.
 *
 * @param rules what a pinned preset sets.
 *
 * @returns the lint rules as errors, and the ones that stay off.
 */
function convertWarningsToErrors(rules: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).map(([rule, entry]) => {
            const entries: unknown[] = Array.isArray(entry) ? entry : [entry];
            const [level, ...options] = entries;
            return [rule, level === 'off' || level === 0 ? 'off' : ['error', ...options]];
        }),
    );
}

export { createBlockWriter, convertWarningsToErrors };
