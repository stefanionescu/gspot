// Keep psql substitutions outside SQL strings and comments while preserving character positions.
const TOKEN =
    /--[^\n]*|\/\*|\b[Ee]'(?:\\[\s\S]|''|[^'\\])*'|'(?:''|[^'])*'|"(?:""|[^"])*"|(?<![\p{L}\p{N}_$])\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$|\\[^\r\n]*|::|:'[A-Za-z_][A-Za-z_0-9]*'|:"[A-Za-z_][A-Za-z_0-9]*"|:[A-Za-z_][A-Za-z_0-9]*/gu;

/**
 * Prepare client-side psql syntax without changing SQL token positions or quoted bodies.
 * @param text the authored SQL with client commands and substitutions
 * @returns parser text and substitution ranges in original UTF-16 coordinates
 */
export function sqlSource(text: string): { text: string; variables: { start: number; end: number }[] } {
    const variables: { start: number; end: number }[] = [];
    const tokens = new RegExp(TOKEN);
    const pieces: string[] = [];
    let offset = 0;
    for (let match = tokens.exec(text); match !== null; match = tokens.exec(text)) {
        const token = match[0];
        if (token === '/*') {
            let depth = 1;
            const comments = /\/\*|\*\//gu;
            comments.lastIndex = tokens.lastIndex;
            for (let comment = comments.exec(text); comment !== null; comment = comments.exec(text)) {
                depth += comment[0] === '/*' ? 1 : -1;
                if (depth === 0) break;
            }
            tokens.lastIndex = depth === 0 ? comments.lastIndex : text.length;
        } else if (token.startsWith('$')) {
            const end = text.indexOf(token, tokens.lastIndex);
            tokens.lastIndex = end === -1 ? text.length : end + token.length;
        } else if (token.startsWith('\\') || (token.startsWith(':') && token !== '::')) {
            pieces.push(text.slice(offset, match.index));
            if (token.startsWith('\\')) pieces.push(' '.repeat(token.length));
            else {
                variables.push({ start: match.index, end: tokens.lastIndex });
                pieces.push(
                    token[1] === "'"
                        ? `''${' '.repeat(token.length - 2)}`
                        : token[1] === '"'
                          ? ` ${token.slice(1)}`
                          : `_${token.slice(1)}`,
                );
            }
            offset = tokens.lastIndex;
        }
    }
    pieces.push(text.slice(offset));
    return { text: pieces.join(''), variables };
}
