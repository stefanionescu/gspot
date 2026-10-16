import { isDeepStrictEqual } from 'node:util';
import { joinScope } from '#cli/repository/scopes.ts';
import { literalGlob } from '#cli/repository/selectors.ts';
import { scopeFiles } from '#cli/generation/eslint/files.ts';
import { ESLINT_BASE_IMPORTS } from '#cli/config/generation/eslint.ts';

import type {
    EslintModule,
    EslintPlugins,
    EslintRuleSource,
    EslintModuleInput,
    EslintFileSelector,
    EslintConfiguration,
    EslintSettingsBlock,
} from '#cli/types/generation/eslint.ts';

function selectorSource(selector: EslintFileSelector): string {
    if (typeof selector === 'string') return JSON.stringify(selector);
    if ('component' in selector)
        return `componentMatches(${selector.component}Parser, ${JSON.stringify(selector.component)}, tseslint.parser)`;
    return `runtimeMatches(${String(selector.runtime.index)})`;
}

function presetRuleSource(rules: EslintSettingsBlock['rules'], preset: EslintRuleSource): string[] {
    const entries = rules === undefined ? [] : Object.entries(rules);
    const changed = Object.fromEntries(
        entries.filter(([name, value]) => !isDeepStrictEqual(value, preset.rules?.[name])),
    );
    const hasPresetRules = preset.rules !== undefined && Object.keys(preset.rules).length > 0;
    if (!hasPresetRules && Object.keys(changed).length === 0) return [];
    const additions = Object.keys(changed).length === 0 ? '' : ', ...' + JSON.stringify(changed);
    return [`rules: { ...${preset.expression}${additions} }`];
}

/**
 * Serialize the same rule and applicability fields retained in the generation baseline.
 *
 * @param block the actual ESLint rule fields.
 * @param runtime plugin, parser, and settings expressions that contain no rule fields.
 * @param preset the declared ESLint preset.
 *
 * @returns a JavaScript configuration block.
 */
function serializeBlock(block: EslintSettingsBlock, runtime = '', preset?: EslintRuleSource): string {
    const { files, rules, ...fields } = block;
    const content = {
        ...fields,
        ...(preset !== undefined || rules === undefined || Object.keys(rules).length === 0 ? {} : { rules }),
    };
    const parts = runtime === '' ? [] : [runtime];
    parts.push(...Object.entries(content).map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`));
    if (preset !== undefined) parts.push(...presetRuleSource(rules, preset));
    if (files !== undefined) {
        const expressions = files.map((entry) => {
            if (!Array.isArray(entry)) return selectorSource(entry);
            const sources = entry.map((selector) => selectorSource(selector)).join(', ');
            return `[${sources}]`;
        });
        parts.push(`files: [${expressions.join(', ')}]`);
    }
    return `{${parts.join(', ')}}`;
}

/**
 * Write ESLint blocks for the selected level and project scope.
 *
 * @param input the level, generated file selectors, your own options, and optional fragment scope.
 *
 * @returns the emitted blocks and their rule options in the same order.
 */
export function eslintModule(input: EslintModuleInput): EslintModule {
    const { allRules, isAll, codeFiles, ruleOptions, scope } = input;
    const blocks: EslintSettingsBlock[] = [];
    return {
        blocks,
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
                              joinScope(literalGlob(scope.path), '**/*'),
                          ]),
                          ignores: [...(payload.ignores ?? []), ...scope.excluded],
                      };
            const block = { ...payload, ...nested, rules };
            const configured = ruleOptions.flatMap((options): EslintSettingsBlock[] => {
                const entries = Object.entries(block.rules).flatMap(([name, value]): [string, unknown][] => {
                    const chosen = options.rules[name];
                    const severity: unknown = Array.isArray(value) ? value[0] : value;
                    return chosen === undefined || severity === 'off' || severity === 0
                        ? []
                        : [[name, [severity, ...chosen]]];
                });
                if (entries.length === 0) return [];
                const selectedRules: Record<string, unknown> = Object.fromEntries<unknown>(entries);
                return [
                    {
                        ...block,
                        files: scopeFiles(block.files ?? codeFiles, options.scope, options.includes),
                        ignores: [...(block.ignores ?? []), ...options.excludes],
                        rules: selectedRules,
                    },
                ];
            });
            const emitted = [block, ...configured];
            blocks.push(...emitted);
            return emitted
                .map((entry, index) => {
                    const source = serializeBlock(entry, index === 0 ? runtime : '', index === 0 ? preset : undefined);
                    return scope === undefined ? source : `stripRuntimeGlobals(${source})`;
                })
                .join(',\n');
        },
    };
}

/**
 * Preserve every preset option while promoting enabled warnings to errors.
 *
 * @param rules the actual rules from a pinned preset.
 *
 * @returns error settings, with disabled rules retained.
 */
export function eslintErrorRules(rules: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).map(([rule, entry]) => {
            const entries: unknown[] = Array.isArray(entry) ? entry : [entry];
            const [level, ...options] = entries;
            return [rule, level === 'off' || level === 0 ? 'off' : ['error', ...options]];
        }),
    );
}

/**
 * Serialize selector expressions for emitted ESLint blocks.
 *
 * @param runtimes the JavaScript runtime selections.
 *
 * @returns the serialized selector definitions.
 */
export function selectorDefinitions(runtimes: EslintConfiguration['runtimes']): string {
    const output: string[] = [
        "\n// The root has no closing separator because TypeScript's project service resolves from its containing folder.\nconst root = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\\\/]$/u, '');\nconst RUNTIME_GLOBAL_NAMES = new Set(Object.keys({ ...globals.node, ...globals.browser, ...globals.worker, ...globals.serviceworker, ...globals['react-native'] }));\n// Keep compiler and test globals from framework presets; runtime APIs have their own file selectors.\nfunction stripRuntimeGlobals(block) {\n    const names = block.languageOptions?.globals;\n    if (names === undefined) return block;\n    return { ...block, languageOptions: { ...block.languageOptions, globals: Object.fromEntries(Object.entries(names).filter(([name]) => !RUNTIME_GLOBAL_NAMES.has(name))) } };\n}\nconst runtimeDeclarations = ",

        JSON.stringify(runtimes),
        ";\nconst runtimeMatchers = runtimeDeclarations.map(({ scope, includes, excludes }) => {\n    const included = includes.map((glob) => picomatch(glob, { dot: true, flags: 's' }));\n    const excluded = excludes.map((glob) => picomatch(glob, { dot: true, flags: 's' }));\n    return (path) => {\n        if (scope !== '' && !path.startsWith(`${scope}/`)) return false;\n        return included.some((pattern) => pattern(path)) && !excluded.some((pattern) => pattern(path));\n    };\n});\nfunction runtimeMatches(index) {\n    const matches = (file) => runtimeMatchers.findLastIndex((matcher) => matcher(relative(root, file).split(sep).join('/'))) === index;\n    return matches;\n}\n// Component parsers keep script language attributes. The last parser checks syntax errors.\nfunction componentMatches(parser, framework, typescriptParser) {\n    return (file) => {\n        try {\n            const parsed = parser.parseForESLint(readFileSync(file, 'utf8'), { filePath: file, tsconfigRootDir: root, ecmaVersion: 'latest', sourceType: 'module', parser: framework === 'vue' ? false : { ts: typescriptParser, typescript: typescriptParser } });\n            const scripts = framework === 'vue' ? parsed.services.getDocumentFragment().children.filter((node) => node.type === 'VElement' && node.name === 'script') : parsed.ast.body.filter((node) => node.type === 'SvelteScriptElement');\n            return scripts.some((script) => script.startTag.attributes.some((attribute) => attribute.key?.name === 'lang' && ['ts', 'typescript'].includes(framework === 'vue' ? attribute.value?.value : attribute.value[0]?.value)));\n        } catch (error) {\n            if (error instanceof SyntaxError || (error instanceof Error && error.name === 'TSError')) return false;\n            throw error;\n        }\n    };\n}\n",
    ];

    return output.join('');
}

/**
 * Serialize access to the manifest's actual preset export.
 *
 * @param variable the runtime settings binding.
 * @param source the source paths and dependency trees.
 *
 * @returns the import expression for the declared preset.
 */
export function presetSource(variable: string, source: string): string {
    return (
        variable +
        (source === ''
            ? ''
            : source
                  .split('.')
                  .map((part) => `[${JSON.stringify(part)}]`)
                  .join(''))
    );
}

/**
 * Serialize fixed imports and selected plugins before the fragment import statements.
 *
 * @param plugins the selected formatter plugins.
 * @param fragments the emitted configuration fragments.
 *
 * @returns the imports used by the generated configuration.
 */
export function eslintImports(plugins: EslintPlugins, fragments: string): string {
    return (
        [...ESLINT_BASE_IMPORTS, ...Object.values(plugins)]
            .map(([binding, source]) => `import ${binding} from ${JSON.stringify(source)};`)
            .join('\n') +
        '\n' +
        fragments +
        '\n'
    );
}

/**
 * Serialize ordered block descriptors and retain the module's calculated rule settings.
 *
 * @param module the named architecture module.
 * @param blocks the emitted ESLint blocks.
 *
 * @returns the serialized ESLint blocks.
 */
export function emitBlocks(module: EslintModule, blocks: Parameters<EslintModule['block']>[]): string {
    return blocks.map((block) => '\n    ' + module.block(...block) + ',\n').join('');
}
