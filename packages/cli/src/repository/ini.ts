/**
 * Select one INI section and its colon-delimited subsections without changing their text.
 * @param text the INI text
 * @param section the section name
 * @returns the section text, or undefined when the file has no such section
 */
export function iniSection(text: string, section: string): string | undefined {
    const selected: string[] = [];
    const seen = new Set<string>();
    let included = false;
    for (const line of text.split('\n')) {
        const header = /^\s*\[([^\]]+)\]\s*(?:[#;].*)?$/u.exec(line)?.[1];
        if (header !== undefined) {
            included = header === section || header.startsWith(`${section}:`);
            if (included) {
                if (seen.has(header)) throw new Error(`Duplicate configuration section: ${header}`);
                seen.add(header);
            }
        }
        if (included) selected.push(line);
    }
    return selected.length === 0 ? undefined : selected.join('\n');
}
