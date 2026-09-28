// A trailing comment belongs to the heading; other trailing text does not declare a section.
function sectionName(line: string): string | undefined {
    const trimmed = line.trim();
    const close = trimmed.indexOf(']');
    const tail = close === -1 ? '' : trimmed.slice(close + 1).trim();
    const isHeader =
        trimmed.startsWith('[') && close > 1 && (tail === '' || tail.startsWith('#') || tail.startsWith(';'));
    return isHeader ? trimmed.slice(1, close) : undefined;
}

/**
 * Select one INI section and its colon-delimited subsections without changing their text.
 * @param text the INI text
 * @param section the section name
 * @returns the section text, or undefined when the file has no such section
 */
export function iniSection(text: string, section: string): string | undefined {
    const seen = new Set<string>();
    let included = false;
    const selected = text.split('\n').flatMap((line) => {
        const header = sectionName(line);
        if (header === undefined) return included ? [line] : [];
        included = header === section || header.startsWith(`${section}:`);
        if (!included) return [];
        if (seen.has(header)) throw new Error(`Duplicate configuration section: ${header}`);
        seen.add(header);
        return [line];
    });
    return selected.length === 0 ? undefined : selected.join('\n');
}
