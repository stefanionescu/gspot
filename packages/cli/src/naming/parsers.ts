// The tree-sitter parsers the extractors use, loaded once per process from the embedded grammars.
import { Language, Parser } from 'web-tree-sitter';
import type { GrammarName } from '#types/naming.ts';
import { grammarBytes } from '#cli/platform/assets.ts';

const DECLARATION_FILE = /\.d\.[cm]?ts$/u;

const state: { isReady: Promise<void> | undefined; parsers: Map<GrammarName, Promise<Parser>> } = {
    isReady: undefined,
    parsers: new Map(),
};

function ready(): Promise<void> {
    state.isReady ??= Parser.init({ wasmBinary: grammarBytes('web-tree-sitter.wasm') });
    return state.isReady;
}

async function build(name: GrammarName): Promise<Parser> {
    await ready();
    const language = await Language.load(grammarBytes(`${name}.wasm`));
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
 * The grammar a file is read with, from its extension.
 * @param path the file path
 * @param language the language preset the file belongs to
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
