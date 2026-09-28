function content(line: string): string {
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = !quoted;
        else if (character === '#' && !quoted) return line.slice(0, index).trim();
    }
    return line.trim();
}

function* configurationLines(text: string): Generator<{ line: string; number: number }> {
    let continuation: string | undefined;
    for (const [index, original] of text.split(/\r?\n/u).entries()) {
        if (continuation !== undefined && original.trimStart().startsWith('#')) continue;
        const line = (continuation ?? '') + content(original);
        if (line.endsWith('\\')) {
            continuation = line.slice(0, -1);
            continue;
        }
        continuation = undefined;
        yield { line, number: index + 1 };
    }
    if (continuation !== undefined) throw new Error('SwiftFormat configuration ends with a line continuation.');
}

function option(line: string, number: number): { key: string; value: string } {
    if (line.startsWith('[') || /^--filter(?:\s|$)/iu.test(line))
        throw new Error('SwiftFormat rule comparison does not support configuration sections or filters.');
    const gap = line.search(/\s/u);
    const key = (gap === -1 ? line.slice(2) : line.slice(2, gap)).toLowerCase();
    if (!line.startsWith('--') || !/^[a-z-]+$/u.test(key))
        throw new Error(`Invalid SwiftFormat option on line ${String(number)}.`);
    return { key, value: gap === -1 ? '' : line.slice(gap).trim() };
}

function ruleNames(value: string, key: string, number: number): string[] {
    const unquoted = value.replaceAll(/"[a-zA-Z\d,\s]*"/gu, '');
    if (unquoted.includes('"') || !/^[a-zA-Z\d,\s]*$/u.test(unquoted))
        throw new Error(`Invalid SwiftFormat ${key} list on line ${String(number)}.`);
    const entries = value
        .replaceAll('"', '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (entries.some((entry) => !/^[a-zA-Z][a-zA-Z\d]*$/u.test(entry)))
        throw new Error(`Invalid SwiftFormat ${key} list on line ${String(number)}.`);
    return entries;
}

/**
 * Read the unfiltered rule lists emitted in SwiftFormat configuration.
 * @param text the configuration text
 * @returns the rule names under each list option
 */
export function swiftformatRules(text: string): Record<string, string[]> {
    const rules: Record<string, string[]> = { enable: [], disable: [], rules: [], 'lint-only': [] };
    for (const { line, number } of configurationLines(text)) {
        if (line === '') continue;
        const { key, value } = option(line, number);
        if (!Object.hasOwn(rules, key)) continue;
        rules[key]?.push(...ruleNames(value, key, number));
    }
    return rules;
}
