export const JSONC_FAILURES = [
    { source: '{"value": }', message: 'Invalid JSON configuration at offset 10: ValueExpected.' },
    { source: '{ value: 1 }', message: 'Invalid JSON configuration at offset 2: InvalidSymbol.' },
    { source: String.raw`{"value":"\q"}`, message: 'Invalid JSON configuration at offset 9: InvalidEscapeCharacter.' },
] as const;

export const JSONC_ENTRIES = [
    { source: '// authored comment\n{"values":[0,false,"",null,],}', value: { values: [0, false, '', null] } },
    { source: 'null', value: null },
    { source: 'false', value: false },
    { source: '0', value: 0 },
] as const;
