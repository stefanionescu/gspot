function stripComment(line: string): string {
    let isQuoted = false;
    let isEscaped = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (isEscaped) isEscaped = false;
        else if (character === '\\') isEscaped = true;
        else if (character === '"') isQuoted = !isQuoted;
        else if (character === '#' && !isQuoted) return line.slice(0, index).trim();
    }
    return line.trim();
}

function* logicalLines(text: string): Generator<{ line: string; number: number }> {
    let continuation: string | undefined;
    for (const [index, original] of text.split(/\r?\n/u).entries()) {
        if (continuation !== undefined && original.trimStart().startsWith('#')) continue;
        const line = (continuation ?? '') + stripComment(original);
        if (line.endsWith('\\')) {
            continuation = line.slice(0, -1);
            continue;
        }
        continuation = undefined;
        yield { line, number: index + 1 };
    }
    if (continuation !== undefined) throw new Error('SwiftFormat configuration ends with a line continuation.');
}

function parseOption(line: string, number: number): { key: string; value: string } {
    if (line.startsWith('[') || /^--filter(?:\s|$)/iu.test(line))
        throw new Error('SwiftFormat rule comparison does not support configuration sections or filters.');
    const gap = line.search(/\s/u);
    const key = (gap === -1 ? line.slice('--'.length) : line.slice('--'.length, gap)).toLowerCase();
    if (!line.startsWith('--') || !/^[a-z-]+$/u.test(key))
        throw new Error(`Invalid SwiftFormat option on line ${String(number)}.`);
    return { key, value: gap === -1 ? '' : line.slice(gap).trim() };
}

function parseRuleNames(value: string, key: string, number: number): string[] {
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
export function parseSwiftformat(text: string): Record<string, string[]> {
    const rules: Record<string, string[]> = { enable: [], disable: [], rules: [], 'lint-only': [] };
    for (const { line, number } of logicalLines(text)) {
        if (line === '') continue;
        const { key, value } = parseOption(line, number);
        if (!Object.hasOwn(rules, key)) continue;
        rules[key]?.push(...parseRuleNames(value, key, number));
    }
    return rules;
}
