import { readFileSync } from 'node:fs';
import { grammarPath } from '#cli/platform/assets.ts';
// The tree-sitter parsers the extractors use, loaded once per process from the embedded grammars.
import { Language, Parser, type Tree } from 'web-tree-sitter';
import type { SourceObservations } from '#cli/types/repository/repository.ts';
import type { GrammarName, ParseContext } from '#cli/types/parsers/parsers.ts';

const DECLARATION_FILE = /\.d\.[cm]?ts$/u;
const observations = new WeakMap<SourceObservations, Map<string, Tree>>();

const state: { isReady: Promise<void> | undefined; parsers: Map<GrammarName, Promise<Parser>> } = {
    isReady: undefined,
    parsers: new Map(),
};

function ready(): Promise<void> {
    state.isReady ??= Parser.init({ wasmBinary: readFileSync(grammarPath('web-tree-sitter.wasm')) });
    return state.isReady;
}

async function build(name: GrammarName): Promise<Parser> {
    await ready();
    const language = await Language.load(readFileSync(grammarPath(`${name}.wasm`)));
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
}

/**
 * The parser for a grammar, built on first use.
 * @param name the grammar
 * @returns the parser
 */
export function parserFor(name: GrammarName): Promise<Parser> {
    let parser = state.parsers.get(name);
    if (parser === undefined) {
        parser = build(name);
        state.parsers.set(name, parser);
    }
    return parser;
}

/**
 * Shares a run-owned parse while giving each reader its own disposable tree handle.
 * @param name the grammar that gives the source its meaning
 * @param text the exact source to parse
 * @param context execution observations and their existing resource owner, when running checks
 * @returns a caller-owned tree copy, or null when parsing cannot produce a tree
 */
export async function parseSource(name: GrammarName, text: string, context?: ParseContext): Promise<Tree | null> {
    const parser = await parserFor(name);
    if (context?.resources === undefined) return parser.parse(text);
    let trees = observations.get(context.observations);
    if (trees === undefined) {
        trees = new Map();
        observations.set(context.observations, trees);
    }
    const key = JSON.stringify([name, text]);
    const held = trees.get(key);
    if (held !== undefined) return held.copy();
    const tree = parser.parse(text);
    if (tree === null) return null;
    trees.set(key, tree);
    context.resources.defer(() => {
        trees.delete(key);
        tree.delete();
    });
    return tree.copy();
}

/**
 * The grammar a file is read with, from its extension.
 * @param path the file path
 * @param language the language configuration the file belongs to
 * @returns the grammar, or undefined when no extractor exists for it
 */
export function grammarFor(path: string, language: string): GrammarName | undefined {
    if (DECLARATION_FILE.test(path)) return undefined;
    if (language === 'bash') return 'bash';
    if (language === 'swift') return 'swift';
    if (language === 'python') return 'python';
    if (language === 'javascript') return 'javascript';
    if (language !== 'typescript') return undefined;
    return path.endsWith('.tsx') ? 'tsx' : 'typescript';
}
