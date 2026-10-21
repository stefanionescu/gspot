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
import { sep, join, relative } from 'node:path';

// TypeScript resolves the project service from the repository root without a closing separator.
const root = fileURLToPath(new URL('../../../..', import.meta.url)).replace(/[\\/]$/u, '');
const componentParserOptions = { tsconfigRootDir: root, ecmaVersion: 'latest', sourceType: 'module' };
/** @type {WeakMap<object, Set<string>>} */
const runtimeGlobalNames = new WeakMap();
/** @type {WeakMap<object, ((path: string) => boolean)[]>} */
const runtimeMatcherGroups = new WeakMap();

/**
 * Resolve project paths against the generated configuration's repository root.
 *
 * @param {string[]} paths repository-relative project paths.
 * @returns {string[]} absolute project paths.
 */
function joinRoot(paths) {
    return paths.map((path) => join(root, path));
}

/**
 * Merge the rule fields of every captured preset block, in their declared order.
 *
 * @param {{rules?: Record<string, unknown>}[]} blocks the selected preset blocks.
 * @returns {Record<string, unknown>} the merged rules.
 */
function mergePresetRules(blocks) {
    return Object.assign({}, ...blocks.map((block) => block.rules));
}

// Framework presets retain compiler and test globals; runtime APIs use their own file selectors.
/**
 * Remove host runtime globals while retaining framework compiler and test names.
 *
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
 *
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

/**
 * Recognize the two script language values that select the TypeScript parser.
 *
 * @param {string | undefined} language the script language attribute.
 * @returns {boolean} whether the attribute requests TypeScript.
 */
function isTypescriptLanguage(language) {
    return language === 'ts' || language === 'typescript';
}

/**
 * Identify parser failures that leave syntax reporting to the final ESLint parser.
 *
 * @param {unknown} error the failure from the component parser.
 * @returns {boolean} whether the component parser rejected the file's syntax.
 */
function isParseError(error) {
    return error instanceof SyntaxError || (error instanceof Error && error.name === 'TSError');
}

// Component parsers preserve script-language attributes. The final parser reports syntax errors.
/**
 * Select Vue files whose script attributes request TypeScript parsing.
 *
 * @param {{parseForESLint: (text: string, options: object) => VueProgram}} parser the component syntax reader.
 * @returns {function(string): boolean} whether a file contains a typed script block.
 */
function vueComponentMatches(parser) {
    return (file) => {
        try {
            const parsed = parser.parseForESLint(readFileSync(file, 'utf8'), {
                ...componentParserOptions,
                filePath: file,
                parser: false,
            });
            return parsed.services
                .getDocumentFragment()
                .children.filter((node) => node.type === 'VElement' && node.name === 'script')
                .some((script) =>
                    script.startTag.attributes.some(
                        (attribute) => attribute.key?.name === 'lang' && isTypescriptLanguage(attribute.value?.value),
                    ),
                );
        } catch (error) {
            if (isParseError(error)) return false;
            throw error;
        }
    };
}

/**
 * Select Svelte files whose script attributes request TypeScript parsing.
 *
 * @param {{parseForESLint: (text: string, options: object) => SvelteProgram}} parser the component syntax reader.
 * @param {object} typescriptParser the parser supplied to typed script blocks.
 * @returns {function(string): boolean} whether a file contains a typed script block.
 */
function svelteComponentMatches(parser, typescriptParser) {
    return (file) => {
        try {
            const parsed = parser.parseForESLint(readFileSync(file, 'utf8'), {
                ...componentParserOptions,
                filePath: file,
                parser: { ts: typescriptParser, typescript: typescriptParser },
            });
            return parsed.ast.body
                .filter((node) => node.type === 'SvelteScriptElement')
                .some((script) =>
                    script.startTag.attributes.some(
                        (attribute) =>
                            attribute.key?.name === 'lang' && isTypescriptLanguage(attribute.value[0]?.value),
                    ),
                );
        } catch (error) {
            if (isParseError(error)) return false;
            throw error;
        }
    };
}

export {
    root,
    joinRoot,
    runtimeMatches,
    mergePresetRules,
    vueComponentMatches,
    stripRuntimeGlobals,
    svelteComponentMatches,
};
