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
        const flag = /^([^:=;#\s]+)\s*(?:\s[;#].*)?$/u.exec(line);
        const option = /^([^:=;#\s]+)(?:\s*[:=]\s*|\s+)(.+?)\s*(?:\s[;#].*)?$/u.exec(line);
        if (flag === null && option === null) throw new Error('Gixy rule configuration contains an invalid option.');
        const key = flag?.[1] ?? `${section}${option?.[1]}`;
        const canonical = key.replace(/^--/u, '');
        if (!['checks', 'tests', 'skips'].includes(canonical)) continue;
        const value = flag === null ? option?.[2] : 'true';
        if (value === undefined || value.startsWith('['))
            throw new Error('Gixy check selectors must be comma-separated strings.');
        result[canonical === 'tests' ? 'checks' : canonical] = value
            .split(',')
            .map((rule) => rule.trim())
            .filter(Boolean);
    }
    return result;
}
