// A decimal numeral with an optional sign, fraction, and exponent, and nothing else.
function isNumeral(text: string): boolean {
    const [mantissa = '', exponent, ...more] = text.toLowerCase().split('e');
    return (
        more.length === 0 &&
        /^[+-]?[\d.]+$/u.test(mantissa) &&
        /\d/u.test(mantissa) &&
        (exponent === undefined || /^[+-]?\d+$/u.test(exponent)) &&
        Number.isFinite(Number(text))
    );
}

function value(text: string): unknown {
    if (isNumeral(text)) return Number(text);
    if (text.toLowerCase() === 'true') return true;
    if (text.toLowerCase() === 'false') return false;
    if (text.toLowerCase() === 'none') return null;
    return text;
}

/**
 * Read SQLFluff's case-sensitive INI sections without loading paths or templaters.
 * @param text the configuration text
 * @returns the keys and values of each section, by section name
 */
export function sqlfluffConfiguration(text: string): Map<string, Map<string, string>> {
    const sections = new Map<string, Map<string, string>>();
    let section: Map<string, string> | undefined;
    let key: string | undefined;
    let indentation = 0;
    for (const [index, original] of text.split(/\r?\n/u).entries()) {
        const line = original.trim();
        if (line.startsWith('#') || line.startsWith(';')) continue;
        if (line === '') {
            if (section !== undefined && key !== undefined) section.set(key, `${section.get(key) ?? ''}\n`);
            continue;
        }
        const indent = original.length - original.trimStart().length;
        if (section !== undefined && key !== undefined && indent > indentation) {
            section.set(key, `${section.get(key) ?? ''}\n${line}`);
            continue;
        }
        indentation = indent;
        const heading = /^\[([^\]]+)\]/u.exec(line)?.[1];
        if (heading !== undefined) {
            if (sections.has(heading)) throw new Error(`Duplicate SQLFluff section on line ${String(index + 1)}.`);
            section = new Map();
            sections.set(heading, section);
            key = undefined;
            continue;
        }
        const separator = line.indexOf('=');
        if (section === undefined || separator <= 0)
            throw new Error(`Invalid SQLFluff configuration on line ${String(index + 1)}.`);
        key = line.slice(0, separator).trimEnd();
        if (section.has(key)) throw new Error(`Duplicate SQLFluff option on line ${String(index + 1)}.`);
        section.set(key, line.slice(separator + 1).trimStart());
    }
    return sections;
}

/**
 * Extract rule collections from the parsed SQLFluff configuration.
 * @param text the configuration text
 * @returns the rule lists and per-rule tables the configuration declares
 */
export function sqlfluffRules(text: string): Record<string, unknown> {
    const sections = sqlfluffConfiguration(text);
    const defaults = sections.get('DEFAULT') ?? new Map<string, string>();
    const core = new Map([...defaults, ...(sections.get('sqlfluff') ?? [])]);
    const options: Record<string, unknown> = Object.fromEntries([
        ...[...(sections.get('sqlfluff:rules') ?? [])].map(([option, setting]): [string, unknown] => [
            option,
            value(setting.trim()),
        ]),
        ...[...sections]
            .filter(([name]) => name.startsWith('sqlfluff:rules:'))
            .map(([name, entries]): [string, unknown] => [
                name.slice('sqlfluff:rules:'.length),
                Object.fromEntries(
                    [...new Map([...defaults, ...entries])].map(([option, setting]): [string, unknown] => [
                        option,
                        value(setting.trim()),
                    ]),
                ),
            ]),
    ]);
    const lists = Object.fromEntries(
        ['rules', 'exclude_rules'].map((name) => [
            name,
            (core.get(name) ?? '')
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean),
        ]),
    );
    return { sqlfluff: lists, 'sqlfluff:rules': options };
}
