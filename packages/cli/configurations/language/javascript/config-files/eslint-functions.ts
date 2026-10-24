import picomatch from 'picomatch';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sep, dirname, relative } from 'node:path';
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
Select the files that one runtime declaration covers: a later declaration that covers a file wins.

@param index the position of the runtime declaration that this matcher stands for.
@param runtimes the runtime declarations, in order.
@returns whether a file belongs to this declaration after later ones apply.
*/
export function runtimeMatches(index: number, runtimes: EslintRuntime[]): (file: string) => boolean {
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
Select the Vue or Svelte files whose script element asks for TypeScript. The final parser reports syntax errors, so a
file that does not parse counts as untyped.

@param parser vue-eslint-parser or svelte-eslint-parser.
@param typescriptParser the parser of TypeScript script elements, which svelte-eslint-parser takes.
@returns whether a file has a TypeScript script element.
*/
export function componentMatches(parser: ComponentParser, typescriptParser?: unknown): (file: string) => boolean {
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
export function importAstroPlugin(moduleUrl: string): unknown {
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
export function importSvelteParser(moduleUrl: string): ComponentParser {
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
