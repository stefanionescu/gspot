export const DEPTRY_SCOPE_EXCLUSIONS = {
    '': [
        String.raw`(^|.*[/\\])\.gspot([/\\]|$)`,
        String.raw`^\x61pp([/\\]|$)`,
        String.raw`^\x61pp[/\\]\x6eested([/\\]|$)`,
        String.raw`^\x6fther([/\\]|$)`,
        'authored',
    ],
    app: [String.raw`(^|.*[/\\])\.gspot([/\\]|$)`, String.raw`^\x6eested([/\\]|$)`, 'authored'],
    'app/nested': [String.raw`(^|.*[/\\])\.gspot([/\\]|$)`, 'authored'],
    other: [String.raw`(^|.*[/\\])\.gspot([/\\]|$)`, 'authored'],
} as const;
