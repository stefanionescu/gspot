export const INVALID_KNIP_REPORTS = [
    '{}',
    '{"issues":{}}',
    '{"issues":[{"file":""}]}',
    '{"issues":[{"file":"source.js","unknown":[{"name":"lost"}]}]}',
    '{"issues":[{"file":"source.js","exports":[{"name":1}]}]}',
    '{"issues":[{"file":"source.js","exports":[{"name":"value","line":0}]}]}',
    '{"issues":[{"file":"source.js","duplicates":[{"name":"value"}]}]}',
] as const;
