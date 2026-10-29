import picomatch from 'picomatch';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sep, join, dirname, relative } from 'node:path';
import type { EslintRuntime } from '#cli/types/generation/eslint.ts';
import type { EslintGlobals, ComponentParser, JavascriptBlock } from '#cli/types/generation/eslint-functions.ts';

export const root = fileURLToPath(new URL('../../../../..', import.meta.url)).replace(/[\\/]$/u, '');

const componentParserOptions = { tsconfigRootDir: root, ecmaVersion: 'latest', sourceType: 'module' };

/**
Remove host runtime globals and keep framework compiler and test names. Runtime APIs get their globals from blocks with
their own file selectors.

@param block the framework ESLint configuration block.
@param globalsByRuntime the globals tables of the globals package, keyed by runtime name.
@returns a copy of the block without the runtime names in its globals, or the block itself when it declares no globals.
*/
export function stripRuntimeGlobals(
    block: JavascriptBlock,
    globalsByRuntime: Record<string, EslintGlobals>,
): JavascriptBlock {
    const blockGlobals = block.languageOptions?.globals;
    if (blockGlobals === undefined) return block;
    const names = new Set(
        Object.keys({
            ...globalsByRuntime['node'],
            ...globalsByRuntime['browser'],
            ...globalsByRuntime['worker'],
            ...globalsByRuntime['serviceworker'],
            ...globalsByRuntime['react-native'],
        }),
    );
    return {
        ...block,
        languageOptions: {
            ...block.languageOptions,
            globals: Object.fromEntries(Object.entries(blockGlobals).filter(([name]) => !names.has(name))),
        },
    };
}

/**
⏎ Select the files that one runtime declaration covers: a later declaration that covers a file wins. ⏎  ⏎ @param index the position of the runtime declaration that this matcher stands for. ⏎ @param runtimes the runtime declarations, in order. ⏎

@param index the position of the runtime declaration that this matcher stands for.
@param runtimes the runtime declarations, in order.
*/
export function buildRuntimeMatcher(index: number, runtimes: EslintRuntime[]): (file: string) => boolean {
    const matchers = runtimes.map(({ scope, includes, excludes }) => {
        const included = includes.map((glob) => picomatch(glob, { dot: true, flags: 's' }));
        const excluded = excludes.map((glob) => picomatch(glob, { dot: true, flags: 's' }));
        return (path: string) =>
            (scope === '' || path.startsWith(`${scope}/`)) &&
            included.some((pattern) => pattern(path)) &&
            excluded.every((pattern) => !pattern(path));
    });
    return (file) => matchers.findLastIndex((matches) => matches(relative(root, file).split(sep).join('/'))) === index;
}

/**
⏎ Select the Vue or Svelte files whose script element asks for TypeScript. The final parser reports syntax errors, so a ⏎ file that does not parse counts as untyped. ⏎  ⏎ @param parser vue-eslint-parser or svelte-eslint-parser. ⏎ @param typescriptParser the parser of TypeScript script elements, which svelte-eslint-parser takes. ⏎

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
Copy a block before applying its configuration calls.

@param block the JSON fields of the block.
@returns a new block.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function buildBlock(block: JavascriptBlock): JavascriptBlock {
    return { ...block };
}

/**
Read one value of a preset or parser package.

@param preset the imported package.
@param path the dotted export path.
@returns the selected export.
*/
export function readPreset(preset: unknown, path: string): unknown {
    let value = preset;
    for (const key of path === '' ? [] : path.split('.')) value = (value as Record<string, unknown>)[key];
    return value;
}

/**
Put one config of an imported preset under the block: its fields, then those of the block, and its rules before the rules of the block.

@param block the block that the generated file writes.
@param preset the default export of the preset package.
@param path the dotted path of the config in that export, empty for the export itself.
@returns a new block.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function mergePreset(block: JavascriptBlock, preset: unknown, path: string): JavascriptBlock {
    const selected = readPreset(preset, path) as JavascriptBlock;
    return { ...selected, ...block, rules: { ...selected.rules, ...block.rules } };
}

/**
Put the rules of one config of an imported preset before the rules of the block, without its other fields.

@param block the block that the generated file writes.
@param preset the default export of the preset package.
@param path the dotted path of the config in that export, empty for the export itself.
@returns a new block.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function mergePresetRules(block: JavascriptBlock, preset: unknown, path: string): JavascriptBlock {
    const selected = readPreset(preset, path) as JavascriptBlock;
    return { ...block, rules: { ...selected.rules, ...block.rules } };
}

/**
Give each enabled gspot rule the severity from the plugin config. Disable rules absent from that config. Keep each rule's options.

@param block the block that the generated file writes.
@param plugin the gspot ESLint plugin.
@param plugin.configs the rule presets by level.
@param config the config of the level, such as recommended.
@returns a new block.
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

function setRuleLevel(value: unknown, level: unknown): unknown {
    const configured: unknown[] = Array.isArray(value) ? value : [value];
    const [severity, ...options] = configured;
    if (severity === 'off' || severity === 0) return value;
    return Array.isArray(value) ? [level, ...options] : level;
}

/**
Set the plugins of the block.

@param block the block that the generated file writes.
@param plugins each imported plugin, by its rule prefix.
@returns a new block.
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
@returns a new block.
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
Set the import-x/resolver-next setting of the block to one TypeScript resolver over the projects.

@param block the block that the generated file writes.
@param createImportLookup createTypeScriptImportResolver of eslint-import-resolver-typescript.
@param projects the tsconfig.json paths, from the repository root.
@returns a new block.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function setImportLookup(
    block: JavascriptBlock,
    createImportLookup: (options: { project: string[] }) => unknown,
    projects: string[],
): JavascriptBlock {
    return {
        ...block,
        settings: {
            ...block.settings,
            'import-x/resolver-next': [createImportLookup({ project: projects.map((project) => join(root, project)) })],
        },
    };
}

/**
Configure the resolver interface of the boundaries plugin.

@param block the configuration block.
@param projects the TypeScript project paths.
@returns the block with its resolver.
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
Set the source type and the globals of the block.

@param block the block that the generated file writes.
@param globals the default export of the globals package.
@param names the globals table of the runtime, such as nodeBuiltin.
@param sourceType commonjs for CommonJS files.
@returns a new block.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function setRuntime(
    block: JavascriptBlock,
    globals: Record<string, EslintGlobals>,
    names: string,
    sourceType: string,
): JavascriptBlock {
    return {
        ...block,
        languageOptions: { ...block.languageOptions, sourceType, globals: globals[names] as EslintGlobals },
    };
}

/**
Set the parser of a Vue or Svelte block. Apply the supplied TypeScript parser to its script elements.

@param block the block that the generated file writes.
@param parser vue-eslint-parser or svelte-eslint-parser.
@param typescriptParser the parser of TypeScript script elements.
@returns a new block.
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
@returns the block with its script parser.
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
Read language globals from the Jest plugin.

@param block the test block.
@param plugin the imported Jest plugin.
@param plugin.environments the test environments.
@param plugin.environments.globals the default Jest environment.
@param plugin.environments.globals.globals the global identifiers of Jest.
@returns the block with Jest globals.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Generated ESLint files import this transformation by name.
export function setJestGlobals(
    block: JavascriptBlock,
    plugin: { environments: { globals: { globals: EslintGlobals } } },
): JavascriptBlock {
    return { ...block, languageOptions: { ...block.languageOptions, globals: plugin.environments.globals.globals } };
}
