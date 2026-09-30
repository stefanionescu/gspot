import type { SqlfluffLine } from '#cli/types/repository/repository.ts';

function value(text: string): unknown {
    const [mantissa = '', ...exponents] = text.toLowerCase().split('e');
    if (
        exponents.length <= 1 &&
        /^[+-]?[\d.]+$/u.test(mantissa) &&
        exponents.every((exponent) => /^[+-]?\d+$/u.test(exponent)) &&
        Number.isFinite(Number(text))
    )
        return Number(text);
    const literals: Record<string, boolean | null> = { true: true, false: false, none: null };
    const keyword = text.toLowerCase();
    return Object.hasOwn(literals, keyword) ? literals[keyword] : text;
}

// Physical continuation lines join the option above them before section names and assignments are read.
function joinContinuations(lines: SqlfluffLine[]): SqlfluffLine[] {
    const logical: SqlfluffLine[] = [];
    for (const line of lines) {
        const previous = logical.at(-1);
        const isOption = previous !== undefined && previous.heading === undefined;
        const isDeeper = previous !== undefined && (line.text === '' || line.indentation > previous.indentation);
        if (isOption && isDeeper) previous.continuation += `\n${line.text}`;
        else if (line.text !== '') logical.push(line);
    }
    return logical;
}

// One option line joins the section that is open, once per key.
function addOption(section: Map<string, string> | undefined, line: SqlfluffLine): void {
    const separator = line.text.indexOf('=');
    if (section === undefined || separator <= 0)
        throw new Error(`Invalid SQLFluff configuration on line ${String(line.number)}.`);
    const key = line.text.slice(0, separator).trimEnd();
    if (section.has(key)) throw new Error(`Duplicate SQLFluff option on line ${String(line.number)}.`);
    section.set(key, line.text.slice(separator + 1).trimStart() + line.continuation);
}

// The sections of the file with their options. A duplicate section, a duplicate option, and an option outside a section are refused.
function parseSections(logical: SqlfluffLine[]): Map<string, Map<string, string>> {
    const sections = new Map<string, Map<string, string>>();
    let current: Map<string, string> | undefined;
    for (const line of logical) {
        if (line.heading === undefined) {
            addOption(current, line);
            continue;
        }
        if (sections.has(line.heading)) throw new Error(`Duplicate SQLFluff section on line ${String(line.number)}.`);
        current = new Map<string, string>();
        sections.set(line.heading, current);
    }
    return sections;
}

/**
 * Read SQLFluff's case-sensitive INI sections without loading paths or templaters.
 * @param text the configuration text
 * @returns the keys and values of each section, by section name
 */
export function sqlfluffConfiguration(text: string): Map<string, Map<string, string>> {
    const lines = text
        .split(/\r?\n/u)
        .map((original, index) => ({
            number: index + 1,
            text: original.trim(),
            continuation: '',
            indentation: original.length - original.trimStart().length,
            heading: /^\[([^\]]+)\]/u.exec(original.trim())?.[1],
        }))
        .filter((line) => !/^[#;]/u.test(line.text));
    // Join physical continuations before interpreting section names or option assignments.
    return parseSections(joinContinuations(lines));
}

/**
 * Extract rule collections from the parsed SQLFluff configuration.
 * @param text the configuration text
 * @returns the rule lists and per-rule tables the configuration declares
 */
export function sqlfluffRules(text: string): Record<string, unknown> {
    const sections = sqlfluffConfiguration(text);
    const defaults = sections.get('DEFAULT') ?? new Map<string, string>();
    const mainSection = new Map([...defaults, ...(sections.get('sqlfluff') ?? [])]);
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
            (mainSection.get(name) ?? '')
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean),
        ]),
    );
    return { sqlfluff: lists, 'sqlfluff:rules': options };
}
