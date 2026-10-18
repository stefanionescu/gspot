/** @typedef {{languageOptions?: {globals?: Record<string, unknown>}}} FrameworkBlock */
/** @typedef {{key?: {name?: string}, value?: {value?: string} | null}} VueAttribute */
/** @typedef {{key?: {name?: string}, value: {value?: string}[]}} SvelteAttribute */
/** @typedef {{type: string, name?: string, startTag: {attributes: VueAttribute[]}}} VueScript */
/** @typedef {{type: string, startTag: {attributes: SvelteAttribute[]}}} SvelteScript */
/** @typedef {{services: {getDocumentFragment: () => {children: VueScript[]}}}} VueProgram */
/** @typedef {{ast: {body: SvelteScript[]}}} SvelteProgram */

import picomatch from 'picomatch';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sep, relative } from 'node:path';

// TypeScript resolves the project service from the repository root without a closing separator.
const root = fileURLToPath(new URL('../../../..', import.meta.url)).replace(/[\\/]$/u, '');
/** @type {WeakMap<object, Set<string>>} */
const runtimeGlobalNames = new WeakMap();
/** @type {WeakMap<object, ((path: string) => boolean)[]>} */
const runtimeMatcherGroups = new WeakMap();

// Framework presets retain compiler and test globals; runtime APIs use their own file selectors.
/**
 * Remove host runtime globals while retaining framework compiler and test names.
 * @param {FrameworkBlock} block the framework ESLint configuration block.
 * @param {Record<string, object>} library the globals tables keyed by runtime name.
 * @returns {FrameworkBlock} the same block with runtime names removed from its globals.
 */
function stripRuntimeGlobals(block, library) {
    const names = block.languageOptions?.globals;
    if (names === undefined) return block;
    let runtimeNames = runtimeGlobalNames.get(library);
    if (runtimeNames === undefined) {
        runtimeNames = new Set(
            Object.keys({
                ...library['node'],
                ...library['browser'],
                ...library['worker'],
                ...library['serviceworker'],
                ...library['react-native'],
            }),
        );
        runtimeGlobalNames.set(library, runtimeNames);
    }
    return {
        ...block,
        languageOptions: {
            ...block.languageOptions,
            globals: Object.fromEntries(Object.entries(names).filter(([name]) => !runtimeNames.has(name))),
        },
    };
}

/**
 * Select the last runtime declaration that covers each file path.
 * @param {number} index the position of the runtime declaration represented by this matcher.
 * @param {{scope: string, includes: string[], excludes: string[]}[]} declarations the ordered runtime declarations.
 * @returns {function(string): boolean} whether a file belongs to this declaration after later overrides.
 */
function runtimeMatches(index, declarations) {
    let matchers = runtimeMatcherGroups.get(declarations);
    if (matchers === undefined) {
        matchers = declarations.map(({ scope, includes, excludes }) => {
            const included = includes.map((glob) => picomatch(glob, { dot: true, flags: 's' }));
            const excluded = excludes.map((glob) => picomatch(glob, { dot: true, flags: 's' }));
            return (path) => {
                if (scope !== '' && !path.startsWith(`${scope}/`)) return false;
                return included.some((pattern) => pattern(path)) && !excluded.some((pattern) => pattern(path));
            };
        });
        runtimeMatcherGroups.set(declarations, matchers);
    }
    return (file) => matchers.findLastIndex((matches) => matches(relative(root, file).split(sep).join('/'))) === index;
}

// Component parsers preserve script-language attributes. The final parser reports syntax errors.
/**
 * Select component files whose script attributes request TypeScript parsing.
 * @param {{parseForESLint: (text: string, options: object) => VueProgram | SvelteProgram}} parser the Vue or Svelte parser that preserves component script attributes.
 * @param {string} framework the component format name.
 * @param {object} typescriptParser the TypeScript parser supplied to typed script blocks.
 * @returns {function(string): boolean} whether a file contains a typed script block.
 */
function componentMatches(parser, framework, typescriptParser) {
    return (file) => {
        try {
            const parsed = parser.parseForESLint(readFileSync(file, 'utf8'), {
                filePath: file,
                tsconfigRootDir: root,
                ecmaVersion: 'latest',
                sourceType: 'module',
                parser: framework === 'vue' ? false : { ts: typescriptParser, typescript: typescriptParser },
            });
            const scripts =
                framework === 'vue'
                    ? /** @type {VueProgram} */ (parsed).services
                          .getDocumentFragment()
                          .children.filter((node) => node.type === 'VElement' && node.name === 'script')
                    : /** @type {SvelteProgram} */ (parsed).ast.body.filter(
                          (node) => node.type === 'SvelteScriptElement',
                      );
            return scripts.some((script) =>
                script.startTag.attributes.some((attribute) => {
                    if (attribute.key?.name !== 'lang') return false;
                    const language =
                        framework === 'vue'
                            ? /** @type {VueAttribute} */ (attribute).value?.value
                            : /** @type {SvelteAttribute} */ (attribute).value[0]?.value;
                    return language === 'ts' || language === 'typescript';
                }),
            );
        } catch (error) {
            if (error instanceof SyntaxError || (error instanceof Error && error.name === 'TSError')) return false;
            throw error;
        }
    };
}

export { root, runtimeMatches, componentMatches, stripRuntimeGlobals };
