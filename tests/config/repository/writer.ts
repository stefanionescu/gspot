export const INVALID_PACKAGE_JSON_TEXTS = [
    { source: '', message: 'package.json:1:1 is not valid JSON: ValueExpected. Fix the file.' },
    { source: '[]', message: 'package.json must contain a JSON object. Fix the file.' },
] as const;
