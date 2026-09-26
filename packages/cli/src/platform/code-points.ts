// Counting characters the way tools that report columns in code points do, without spreading a string.

/**
 * The code points of a text, one string each.
 * @param text the text
 * @returns the code points in order
 */
export function codePoints(text: string): string[] {
    const characters: string[] = [];
    for (const character of text) characters.push(character);
    return characters;
}
