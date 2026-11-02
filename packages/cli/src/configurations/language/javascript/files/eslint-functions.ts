import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sep, join, dirname, relative } from 'node:path';

import type {
    EslintRuntime,
    EslintGlobals,
    ComponentParser,
    JavascriptBlock,
    EslintRuleOptionBlock,
} from '#cli/types/configurations/language.ts';

export const root = fileURLToPath(new URL('../../../../..', import.meta.url)).replace(/[\\/]$/u, '');

let importLookup: unknown;

const componentParserOptions = { tsconfigRootDir: root, ecmaVersion: 'latest', sourceType: 'module' };

function pickRuleOptions(
    block: JavascriptBlock,
    options: EslintRuleOptionBlock,
): (JavascriptBlock & { rules: Record<string, unknown> })[] {
    const rules = block.rules === undefined ? [] : Object.entries(block.rules);
    const picked = rules.flatMap(([name, value]): [string, unknown][] => {
        const override = options.rules[name];
        const severity: unknown = Array.isArray(value) ? value[0] : value;
        return override === undefined || severity === 'off' || severity === 0 ? [] : [[name, [severity, ...override]]];
    });
    if (picked.length === 0) return [];
    const files = block.files?.flatMap((file) => options.paths.map((path) => [...[file].flat(), ...path]));
    return [
        {
            files: files ?? options.paths,
            ignores: [...(block.ignores ?? []), ...options.ignores],
            rules: Object.fromEntries(picked),
        },
    ];
}

function setRuleLevel(value: unknown, level: unknown): unknown {
    const configured: unknown[] = Array.isArray(value) ? value : [value];
    const [severity, ...options] = configured;
    if (severity === 'off' || severity === 0) return value;
    return Array.isArray(value) ? [level, ...options] : level;
}

/**
Remove host runtime globals and keep framework compiler and test names. Runtime APIs get their globals from blocks with
their own file selectors.

@param preset the config or configs of a framework.
@param globalsByRuntime the globals tables of the globals package, keyed by runtime name.
@returns a copy of each config without the runtime names in its globals.
*/
export function stripRuntimeGlobals(
    preset: JavascriptBlock | JavascriptBlock[],
    globalsByRuntime: Record<string, EslintGlobals>,
): JavascriptBlock[] {
    const names = new Set(
        Object.keys({
            ...globalsByRuntime['node'],
            ...globalsByRuntime['browser'],
            ...globalsByRuntime['worker'],
            ...globalsByRuntime['serviceworker'],
            ...globalsByRuntime['react-native'],
        }),
    );
    return [preset].flat().map((config) => {
        const configGlobals = config.languageOptions?.globals;
        if (configGlobals === undefined) return config;
        return {
            ...config,
            languageOptions: {
                ...config.languageOptions,
                globals: Object.fromEntries(Object.entries(configGlobals).filter(([name]) => !names.has(name))),
            },
        };
    });
}

/**
Select the files that one runtime declaration covers. A later matching declaration wins.

@param index the position of the runtime declaration that this matcher stands for.
@param runtimes the runtime declarations, in order, with their globs compiled to regular expression sources.
*/
export function buildRuntimeMatcher(index: number, runtimes: EslintRuntime[]): (file: string) => boolean {
    const matchers = runtimes.map(({ scope, includes, excludes }) => {
        const included = includes.map((source) => new RegExp(source, 's'));
        const excluded = excludes.map((source) => new RegExp(source, 's'));
        return (path: string) =>
            (scope === '' || path.startsWith(`${scope}/`)) &&
            included.some((pattern) => pattern.test(path)) &&
            excluded.every((pattern) => !pattern.test(path));
    });
    return (file) => matchers.findLastIndex((matches) => matches(relative(root, file).split(sep).join('/'))) === index;
}

/**
Select Vue or Svelte files whose script element asks for TypeScript. The final parser reports syntax errors;
a file that does not parse counts as untyped.

@param parser vue-eslint-parser or svelte-eslint-parser.
@param typescriptParser the parser of TypeScript script elements, which svelte-eslint-parser takes.
*/
export function buildComponentMatcher(parser: ComponentParser, typescriptParser?: unknown): (file: string) => boolean {
    const scriptParser =
        typescriptParser === undefined ? false : { ts: typescriptParser, typescript: typescriptParser };
    return (file) => {
        try {
            const parsed = parser.parseForESLint(readFileSync(file, 'utf8'), {
                ...componentParserOptions,
                filePath: file,
                parser: scriptParser,
            });
            const vueComponent = parsed.services?.getDocumentFragment?.();
            const languages =
                vueComponent === undefined
                    ? parsed.ast.body
                          .filter((node) => node.type === 'SvelteScriptElement')
                          .flatMap((script) => script.startTag.attributes)
                          .filter((attribute) => attribute.key?.name === 'lang')
                          .map((attribute) => attribute.value[0]?.value)
                    : vueComponent.children
                          .filter((node) => node.type === 'VElement' && node.name === 'script')
                          .flatMap((script) => script.startTag.attributes)
                          .filter((attribute) => attribute.key?.name === 'lang')
                          .map((attribute) => attribute.value?.value);
            return languages.some((language) => language === 'ts' || language === 'typescript');
        } catch (error) {
            if (error instanceof SyntaxError || (error instanceof Error && error.name === 'TSError')) return false;
            throw error;
        }
    };
}

/**
Load Astro and its accessibility peer from the generated tool project.

@param moduleUrl the generated configuration module URL.
@returns the rules, processors, and recommended component configurations.
*/
export function importAstroPlugin(moduleUrl: string = import.meta.url): unknown {
    const previousFolder = process.cwd();
    try {
        process.chdir(dirname(fileURLToPath(moduleUrl)));
        const require = createRequire(moduleUrl);
        const pluginRequire = createRequire(require.resolve('eslint-plugin-astro/package.json'));
        const plugin: unknown = pluginRequire('./lib/index.mjs');
        return typeof plugin === 'object' && plugin !== null && 'default' in plugin ? plugin.default : plugin;
    } finally {
        process.chdir(previousFolder);
    }
}

/**
Read Svelte's parser dependencies from the generated tool project.

@param moduleUrl the generated configuration module URL.
@returns a component parser that restores the working folder after each parse.
*/
export function importSvelteParser(moduleUrl: string = import.meta.url): ComponentParser {
    const parser = createRequire(moduleUrl)('svelte-eslint-parser') as ComponentParser;
    return {
        ...parser,
        parseForESLint(code, options) {
            const previousFolder = process.cwd();
            try {
                process.chdir(dirname(fileURLToPath(moduleUrl)));
                return parser.parseForESLint(code, options);
            } finally {
                process.chdir(previousFolder);
            }
        },
    };
}

/**
Put the rules of a preset before the rules of the block, without its other fields. A preset list gives the rules of each
config in order.

@param block the block that the generated file writes.
@param preset the config or configs of the preset.
*/
export function mergePresetRules(block: JavascriptBlock, preset: JavascriptBlock | JavascriptBlock[]): JavascriptBlock {
    const rules = [preset, block]
        .flat()
        .flatMap((config) => (config.rules === undefined ? [] : Object.entries(config.rules)));
    return { ...block, rules: Object.fromEntries(rules) };
}

/**
Add options to rules that the block already sets, and keep their severity. A rule that the block sets without options
keeps its value.

@param block the block after its preset.
@param options the added options of each rule.
*/
export function mergeRuleOptions(
    block: JavascriptBlock,
    options: Record<string, Record<string, unknown>>,
): JavascriptBlock {
    const rules = { ...block.rules };
    for (const [name, added] of Object.entries(options)) {
        const value = rules[name];
        if (Array.isArray(value)) rules[name] = [value[0], { ...(value[1] as object | undefined), ...added }];
    }
    return { ...block, rules };
}

/**
Give your rule options to each rule that a block turns on, in a block right after it that keeps its severity. Refuse
options for a rule that no block turns on.

@param blocks the blocks of the ESLint config, in order.
@param ruleOptions the options of each scope and path override, with the file patterns that they cover.
@returns the blocks with the option blocks after them.
*/
export function setRuleOptions(blocks: JavascriptBlock[], ruleOptions: EslintRuleOptionBlock[]): JavascriptBlock[] {
    const pairs = blocks.map((block) => ({
        block,
        picked: ruleOptions.flatMap((options) => pickRuleOptions(block, options)),
    }));
    const applied = new Set(pairs.flatMap(({ picked }) => picked.flatMap((option) => Object.keys(option.rules))));
    const refused = [...new Set(ruleOptions.flatMap((options) => Object.keys(options.rules)))].filter(
        (name) => !applied.has(name),
    );
    if (refused.length > 0)
        throw new Error(
            refused
                .map(
                    (name) =>
                        `gspot runs ${name} at no level, so it takes no options. For a rule of your own, add a [[tools.eslint.plugins]] record.`,
                )
                .join('\n'),
        );
    return pairs.flatMap(({ block, picked }) => [block, ...picked]);
}

/**
Give each enabled gspot rule the severity from the plugin config. Disable rules absent from that config. Keep each rule's options.

@param block the block that the generated file writes.
@param plugin the gspot ESLint plugin.
@param plugin.configs the rule presets by level.
@param config the config of the level, such as recommended.
*/
export function setLevelRules(
    block: JavascriptBlock,
    plugin: { configs: Record<string, JavascriptBlock> },
    config: string,
): JavascriptBlock {
    const rulePairs = block.rules === undefined ? [] : Object.entries(block.rules);
    const rules: Record<string, unknown> = Object.fromEntries(rulePairs);
    for (const [name, value] of rulePairs) {
        if (!name.startsWith('gspot/')) continue;
        const level = plugin.configs[config]?.rules?.[name] ?? 'off';
        rules[name] = setRuleLevel(value, level);
    }
    return { ...block, rules };
}

/**
Set the plugins of the block.

@param block the block that the generated file writes.
@param plugins each imported plugin, by its rule prefix.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function addPlugins(block: JavascriptBlock, plugins: Record<string, unknown>): JavascriptBlock {
    return { ...block, plugins: { ...block.plugins, ...plugins } };
}

/**
Set each key of the block to the repository root, or to the scope folder under it.

@param block the block that the generated file writes.
@param keys the dotted keys, such as languageOptions.parserOptions.tsconfigRootDir.
@param scope the scope folder, from the root.
*/
export function setRootFolder(block: JavascriptBlock, keys: string[][], scope = ''): JavascriptBlock {
    const result: JavascriptBlock = { ...block };
    for (const path of keys) {
        let target: Record<string, unknown> = result;
        for (const key of path.slice(0, -1)) {
            const child = { ...(target[key] as Record<string, unknown> | undefined) };
            target[key] = child;
            target = child;
        }
        target[path.at(-1) as string] = join(root, scope);
    }
    return result;
}

/**
Set the import-x/resolver-next setting of the block to the TypeScript resolver over the projects. Every block of a
config shares one resolver.

@param block the block that the generated file writes.
@param createImportLookup createTypeScriptImportResolver of eslint-import-resolver-typescript.
@param projects the tsconfig.json paths, from the repository root.
*/
export function setImportLookup(
    block: JavascriptBlock,
    createImportLookup: (options: { project: string[] }) => unknown,
    projects: string[],
): JavascriptBlock {
    importLookup ??= createImportLookup({ project: projects.map((project) => join(root, project)) });
    return { ...block, settings: { ...block.settings, 'import-x/resolver-next': [importLookup] } };
}

/**
Configure the resolver interface of the boundaries plugin.

@param block the configuration block.
@param projects the TypeScript project paths.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function setBoundaryLookup(block: JavascriptBlock, projects: string[]): JavascriptBlock {
    return {
        ...block,
        settings: {
            ...block.settings,
            'import/resolver': { typescript: { project: projects.map((project) => join(root, project)) } },
        },
    };
}

/**
Set the source type and the globals of the block. Refuse a runtime that the globals package does not name.

@param block the block that the generated file writes.
@param globals the default export of the globals package.
@param names the globals table of the runtime, such as nodeBuiltin.
@param sourceType commonjs for CommonJS files.
*/
export function setRuntime(
    block: JavascriptBlock,
    globals: Record<string, EslintGlobals>,
    names: string,
    sourceType: string,
): JavascriptBlock {
    const selected = globals[names];
    if (selected === undefined)
        throw new Error(
            `The globals package has no runtime named ${names}. Set tools.eslint.override.runtime to one of: ${Object.keys(globals).join(', ')}.`,
        );
    return { ...block, languageOptions: { ...block.languageOptions, sourceType, globals: selected } };
}

/**
Set the parser of a Vue or Svelte block. Apply the supplied TypeScript parser to its script elements.

@param block the block that the generated file writes.
@param parser vue-eslint-parser or svelte-eslint-parser.
@param typescriptParser the parser of TypeScript script elements.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function setComponentParser(
    block: JavascriptBlock,
    parser: unknown,
    typescriptParser?: unknown,
): JavascriptBlock {
    const options = block.languageOptions?.['parserOptions'] as Record<string, unknown> | undefined;
    return {
        ...block,
        languageOptions: {
            ...block.languageOptions,
            parser,
            parserOptions: {
                ...options,
                ...(typescriptParser === undefined
                    ? {}
                    : { parser: { ts: typescriptParser, typescript: typescriptParser } }),
            },
        },
    };
}

/**
Set the TypeScript parser of an Astro component.

@param block the component block.
@param parser the TypeScript parser.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function setScriptParser(block: JavascriptBlock, parser: unknown): JavascriptBlock {
    return {
        ...block,
        languageOptions: {
            ...block.languageOptions,
            parserOptions: { ...(block.languageOptions?.['parserOptions'] as Record<string, unknown>), parser },
        },
    };
}

/**
Replace the globals of the test block with the Jest globals of the plugin.

@param block the test block.
@param plugin the imported Jest plugin.
@param plugin.environments the test environments.
@param plugin.environments.globals the default Jest environment.
@param plugin.environments.globals.globals the global identifiers of Jest.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function setJestGlobals(
    block: JavascriptBlock,
    plugin: { environments: { globals: { globals: EslintGlobals } } },
): JavascriptBlock {
    return { ...block, languageOptions: { ...block.languageOptions, globals: plugin.environments.globals.globals } };
}
