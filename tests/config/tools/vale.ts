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

/** Each style keeps its substantive prose check without treating source notation as a defect. */
export const STYLE_CASES = [
    {
        rule: 'file-paths',
        path: 'paths.md',
        source: '# Guide\n\nInspect src/view.tsx.\n\nInspect src/site.css.\n\nInspect src/lib.go.\n\nInspect src/lib.rs.\n\nUse `src/view.tsx` in the command.\n',
        lines: [3, 5, 7, 9],
    },
    {
        rule: 'since',
        path: 'source.ts',
        source: '/**\n * @since 1.2.0\n */\n// Use cached values since the source is stable.\nconst sinceValue = "since";\n',
        lines: [4],
    },
    {
        rule: 'future',
        path: 'future.md',
        source: '# Guide\n\nThe feature will be added.\n\nA todo app lists tasks.\n\nUse TODO to label work.\n',
        lines: [3],
    },
    {
        rule: 'placeholders',
        path: 'parameters.md',
        source: '# Guide\n\nSupply YOUR_TOKEN.\n\nSupply {{token}}.\n\nUse <api-token> in the command.\n',
        lines: [3, 5],
    },
] as const;
