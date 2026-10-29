export const INI_HEADING_CASES = [
    ['too long', '[sqlfluffbox]\nvalue = 3\n'],
    ['incomplete', '[sqlfluff\nvalue = 3\n'],
] as const;
