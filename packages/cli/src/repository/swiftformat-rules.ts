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

/**
 * Read the unfiltered rule lists emitted in SwiftFormat configuration.
 * @param text the configuration text
 * @returns the rule names under each list option
 */
export function swiftformatRules(text: string): Record<string, string[]> {
    const rules: Record<string, string[]> = { enable: [], disable: [], rules: [], 'lint-only': [] };
    const lines = text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
        let line = content(lines[index] ?? '');
        while (line.endsWith('\\')) {
            index += 1;
            const next = lines[index];
            if (next === undefined) throw new Error('SwiftFormat configuration ends with a line continuation.');
            if (!next.trimStart().startsWith('#')) line = line.slice(0, -1) + content(next);
        }
        if (line === '') continue;
        if (line.startsWith('[') || /^--filter(?:\s|$)/iu.test(line))
            throw new Error('SwiftFormat rule comparison does not support configuration sections or filters.');
        const option = /^--([a-z-]+)(?:\s+(.*))?$/iu.exec(line);
        const key = option?.[1]?.toLowerCase();
        if (key === undefined) throw new Error(`Invalid SwiftFormat option on line ${String(index + 1)}.`);
        if (!Object.hasOwn(rules, key)) continue;
        const value = option?.[2] ?? '';
        if (!/^(?:[a-zA-Z\d,\s]|"[a-zA-Z\d,\s]*")*$/u.test(value))
            throw new Error(`Invalid SwiftFormat ${key} list on line ${String(index + 1)}.`);
        const entries = value
            .replaceAll('"', '')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
        if (entries.some((entry) => !/^[a-zA-Z][a-zA-Z\d]*$/u.test(entry)))
            throw new Error(`Invalid SwiftFormat ${key} list on line ${String(index + 1)}.`);
        rules[key]?.push(...entries);
    }
    return rules;
}
