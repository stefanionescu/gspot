import { buildScopeGlob, buildScopeFiles } from '#cli/generation/eslint/files.ts';
import { serializeBlock, indentEslintBlock } from '#cli/generation/eslint/print.ts';

import type {
    EslintBlockInput,
    BlockWriterInput,
    EslintSettingsBlock,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

// Your own options apply only to rules that this block already enables. Each applied rule joins the applied set.
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
        for (const [name] of entries) input.applied.add(name);
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
function formatBlocks(blocks: EslintSettingsBlock[], call: EslintBlockInput, level: BlockWriterInput['level']): string {
    return blocks
        .map((entry, index) => {
            let runtimeText = '';
            let selectedPreset: EslintRuleExpression | undefined;
            let note = call.label;
            if (index === 0) {
                runtimeText = call.properties ?? '';
                selectedPreset = call.preset;
                if (call.preset !== undefined) note += ': ' + call.preset.expression;
            } else note += ': your own rule options';
            const source = serializeBlock(entry, {
                properties: runtimeText,
                preset: selectedPreset,
                level: call.scope === undefined ? level : undefined,
            });
            const value = call.scope === undefined ? source : `stripRuntimeGlobals(${source}, globals)`;
            return indentEslintBlock(`// ${note}\n${value}`);
        })
        .join(',\n');
}

/**
 * Print a block and record the rule options it applies.
 *
 * @param input the file's rule options and shared applied set.
 * @param call the block, its scope, and its label.
 * @returns the serialized block and any applicable option blocks.
 */
function writeEslintBlock(input: BlockWriterInput, call: EslintBlockInput): string {
    const { allRules, level, codeFiles } = input;
    const { data: payload, scope } = call;
    const rules: Record<string, unknown> = Object.fromEntries(
        (payload.rules === undefined ? [] : Object.entries(payload.rules)).map(([name, value]) => [
            name,
            level !== 'all' && allRules.has(name) ? 'off' : value,
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
    const block = { ...payload, ...nested, rules };
    return formatBlocks([block, ...buildOptionBlocks(block, input)], call, level);
}

/**
 * List your rule options that no enabled block accepted.
 *
 * @param input the options and the shared applied set.
 * @returns the unapplied rule names.
 */
function listUnappliedRules(input: BlockWriterInput): string[] {
    return [
        ...new Set(
            input.ruleOptions
                .flatMap((options) => Object.keys(options.rules))
                .filter((rule) => !input.applied.has(rule)),
        ),
    ];
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

/**
 * Serialize the blocks in order with the block writer of the scope.
 *
 * @param input the shared rule options and applied set.
 * @param blocks the block arguments, in order.
 *
 * @returns the serialized ESLint blocks.
 */
function serializeBlocks(input: BlockWriterInput, blocks: EslintBlockInput[]): string {
    return blocks.map((block) => writeEslintBlock(input, block)).join(',\n');
}

export { serializeBlocks, listUnappliedRules, convertWarningsToErrors };
