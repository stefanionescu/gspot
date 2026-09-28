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
    const logical = lines.reduce<typeof lines>((joined, line) => {
        const previous = joined.at(-1);
        if (
            previous !== undefined &&
            previous.heading === undefined &&
            (line.text === '' || line.indentation > previous.indentation)
        ) {
            previous.continuation += `\n${line.text}`;
            return joined;
        }
        if (line.text !== '') joined.push(line);
        return joined;
    }, []);
    const parsed = logical.reduce<{
        sections: Map<string, Map<string, string>>;
        current: Map<string, string> | undefined;
    }>(
        (state, line) => {
            if (line.heading !== undefined) {
                if (state.sections.has(line.heading))
                    throw new Error(`Duplicate SQLFluff section on line ${String(line.number)}.`);
                const section = new Map<string, string>();
                state.sections.set(line.heading, section);
                return { sections: state.sections, current: section };
            }
            const separator = line.text.indexOf('=');
            if (state.current === undefined || separator <= 0)
                throw new Error(`Invalid SQLFluff configuration on line ${String(line.number)}.`);
            const key = line.text.slice(0, separator).trimEnd();
            if (state.current.has(key)) throw new Error(`Duplicate SQLFluff option on line ${String(line.number)}.`);
            state.current.set(key, line.text.slice(separator + 1).trimStart() + line.continuation);
            return state;
        },
        { sections: new Map(), current: undefined },
    );
    return parsed.sections;
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
