/**
 * Read Gixy's root check selectors without flattening plugin-specific sections.
 * @param text the configuration text
 * @returns the values of each list option, by option
 */
export function gixyRules(text: string): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    let section = '';
    for (const source of text.split(/\r?\n/u)) {
        const line = source.trim();
        if (line === '' || /^[#;]/u.test(line) || line.startsWith('---')) continue;
        if (line.startsWith('[')) {
            section = `${line.slice(1, -1).replaceAll('_', '-')}-`;
            continue;
        }
        const comment = line.search(/\s[;#]/u);
        const statement = comment === -1 ? line : line.slice(0, comment).trimEnd();
        const nameEnd = statement.search(/[:=;#\s]/u);
        const name = nameEnd === -1 ? statement : statement.slice(0, nameEnd);
        const rest = statement.slice(name.length).trim();
        const isFlag = rest === '';
        const value = isFlag ? 'true' : rest.replace(/^[:=]\s*/u, '');
        if (name === '' || value === '') throw new Error('Gixy rule configuration contains an invalid option.');
        const key = isFlag ? name : `${section}${name}`;
        const canonical = key.replace(/^--/u, '');
        if (!['checks', 'tests', 'skips'].includes(canonical)) continue;
        if (value.startsWith('[')) throw new Error('Gixy check selectors must be comma-separated strings.');
        result[canonical === 'tests' ? 'checks' : canonical] = value
            .split(',')
            .map((rule) => rule.trim())
            .filter(Boolean);
    }
    return result;
}
