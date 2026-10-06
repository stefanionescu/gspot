/** Currency notation in prose must not mistake source comment parameters for amounts. */
export const CURRENCY_CASES = [
    {
        path: 'prices.md',
        source: '# Prices\n\nThe price is $5.00.\n\nThe price is $15.\n\nThe price is 5 dollars.\n\nThe price is USD 5.\n',
        lines: [3, 5, 7],
    },
    { path: 'source.sh', source: '# Read $1 and $2 as positional parameters.\nprintf "%s" "$1"\n', lines: [] },
    { path: 'source.ts', source: '// Use $1 as the regular expression replacement.\nconst value = 1;\n', lines: [] },
] as const;
