const TOKENS =
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|[;{}]|(?:\\[\s\S]|\$\{[^}]*\}|[^\s"'{};#\\])(?:\\[\s\S]|\$\{[^}]*\}|[^\s{};\\])*/gu;
const ESCAPES: Record<string, string> = { t: '\t', r: '\r', n: '\n', '"': '"', "'": "'", '\\': '\\' };

/** Read directive arguments without changing quoted whitespace or treating comments as configuration. */
export function nginxDirectives(text: string): string[][] {
    const directives: string[][] = [];
    let directive: string[] = [];
    for (const [token] of text.matchAll(TOKENS)) {
        if (token.startsWith('#')) continue;
        if (token === ';' || token === '{' || token === '}') {
            if (token !== '}' && directive.length > 0) directives.push(directive);
            directive = [];
            continue;
        }
        const value = token.replace(/^(["'])([\s\S]*)\1$/u, '$2');
        directive.push(value.replace(/\\([trn"'\\])/gu, (_, escaped: string) => ESCAPES[escaped]!));
    }
    return directives;
}
