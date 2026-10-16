import { NEXT_MESSAGES } from '#tests/data/checks/nextjs.ts';

/** The translations settings naming the message directory and base locale. */
const NEXT_TRANSLATIONS = `[translations]
messages_folder = "messages"
base_locale = "en"
`;

const TRANSLATION_SANDBOX = {
    configurations: ['translations'],
    dependencies: { 'next-intl': '4.3.9' },
    files: NEXT_MESSAGES,
} as const;

const TRANSLATION_CASES = [
    {
        check: 'translations/messages',
        files: {
            'messages/de.json': `{
    "home": { "title": "Start" }
}
`,
        },
        settings: NEXT_TRANSLATIONS,
        expected: { file: 'messages/de.json', rule: 'missing-key', line: 1 },
    },
    {
        check: 'translations/messages',
        files: {
            'messages/de.json': `{
    "home": { "title": "Start", "greeting": "Hallo {name" }
}
`,
        },
        settings: NEXT_TRANSLATIONS,
        expected: { file: 'messages/de.json', rule: 'message', line: 1 },
    },
] as const;

export { TRANSLATION_CASES, TRANSLATION_SANDBOX };
