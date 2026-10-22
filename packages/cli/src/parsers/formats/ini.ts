/**
 * Find one INI section or its colon-delimited subsections.
 *
 * @param text the file contents.
 * @param section the INI heading to match, including colon-delimited subsections.
 * @returns true when a matching bracketed heading starts a line.
 */
export function hasIniSection(text: string, section: string): boolean {
    const header = new RegExp(String.raw`^\s*\[${RegExp.escape(section)}(?::[^\]]+)?\]\s*(?:[#;].*)?$`, 'mu');
    return header.test(text);
}
