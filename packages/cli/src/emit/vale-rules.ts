/** Read Vale rule overrides and selected styles separately for each file-pattern section. */
export function valeRules(text: string): Record<string, unknown> {
    const sections = new Map<string, Map<string, string[]>>();
    let section = new Map<string, string[]>();
    sections.set('DEFAULT', section);
    const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
        const line = (lines[index] ?? '').trim();
        if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;
        if (line.startsWith('[')) {
            const end = line.lastIndexOf(']');
            if (end < 0) throw new Error(`Unclosed Vale section on line ${index + 1}.`);
            const name = line.slice(1, end);
            section = sections.get(name) ?? new Map<string, string[]>();
            sections.set(name, section);
            continue;
        }
        const entry = /^(?:"([^"]+)"|`([^`]+)`|([^=:]+))\s*[=:]\s*(.*)$/u.exec(line);
        const key = (entry?.[1] ?? entry?.[2] ?? entry?.[3])?.trim();
        if (key === undefined || key === '') throw new Error(`Invalid Vale option on line ${index + 1}.`);
        let value = entry?.[4] ?? '';
        const quote = value.startsWith('"""') ? '"""' : value.startsWith('`') ? '`' : undefined;
        if (quote !== undefined) {
            value = value.slice(quote.length);
            while (!value.includes(quote)) {
                index += 1;
                const next = lines[index];
                if (next === undefined) throw new Error('Unterminated Vale quoted value.');
                value += `\n${next}`;
            }
            value = value.slice(0, value.lastIndexOf(quote));
        } else {
            while (value.endsWith('\\')) {
                index += 1;
                const next = lines[index];
                if (next === undefined) throw new Error('Vale configuration ends with a line continuation.');
                value = value.slice(0, -1) + next.trim();
            }
            const comment = value.indexOf(' #') >= 0 ? value.indexOf(' #') : value.indexOf(' ;');
            if (comment >= 0) value = value.slice(0, comment).trimEnd();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
                value = value.slice(1, -1);
        }
        const values = section.get(key) ?? [];
        if (!values.includes(value)) values.push(value);
        section.set(key, values);
    }
    return Object.fromEntries(
        [...sections].map(([name, entries]) => [
            name,
            {
                rules: Object.fromEntries(
                    [...entries].filter(([key]) => key.includes('.')).map(([key, values]) => [key, values.at(-1)]),
                ),
                BasedOnStyles: (entries.get('BasedOnStyles') ?? []).flatMap((value) =>
                    value
                        .split(',')
                        .map((style) => style.trim())
                        .filter(Boolean),
                ),
            },
        ]),
    );
}
