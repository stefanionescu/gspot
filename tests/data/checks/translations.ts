import { NEXT_MESSAGES } from '#tests/data/checks/nextjs.ts';

/** The translations settings that name the message folder and base locale. */
export const TRANSLATION_TABLES = `[translations]
messages_folder = "messages"
base_locale = "en"
`;

export const TRANSLATION_SANDBOX = {
    configurations: ['translations'],
    dependencies: { 'next-intl': '4.3.9' },
    files: NEXT_MESSAGES,
} as const;

export const TRANSLATION_CASES = [
    {
        check: 'translations/messages',
        files: {
            'messages/de.json': `{
    "home": { "title": "Start" }
}
`,
        },
        settings: TRANSLATION_TABLES,
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
        settings: TRANSLATION_TABLES,
        expected: { file: 'messages/de.json', rule: 'message', line: 1 },
    },
] as const;

export const MESSAGE_LAYOUTS: {
    layout: string;
    files: Record<string, string>;
    expected: { file: string; message: string }[];
}[] = [
    {
        layout: 'nested catalogs',
        files: {
            'messages/en.json': '{"title":"Shop"}',
            'messages/fr.json': '{"title":"Boutique"}',
            'messages/admin/en.json': '{"users":"Users"}',
            'messages/admin/fr.json': '{}',
        },
        expected: [{ file: 'messages/admin/fr.json', message: 'The key users of en has no message here.' }],
    },
    {
        layout: 'locale folders',
        files: {
            'messages/en/common.json': '{"hello":"Hello"}',
            'messages/fr/common.json': '{}',
            'messages/en/admin.json': '{"users":"Users"}',
            'messages/fr/admin.json': '{"users":"Utilisateurs"}',
        },
        expected: [{ file: 'messages/fr/common.json', message: 'The key hello of en has no message here.' }],
    },
];

export const MESSAGE_ARGUMENTS = {
    base: {
        greet: 'Hello {name}, you have {count, plural, one {# item} other {# items}}.',
        pick: '{gender, select, male {He} female {She} other {They}} replied.',
        link: 'Read <b>this</b>.',
    },
    translated: {
        greet: 'Bonjour {nom}, vous avez {count, plural, one {# article} many {# articles} other {# articles}}.',
        pick: '{gender, select, male {Il} other {Iel}} a répondu.',
        link: 'Lisez <b>ceci</b>.',
    },
} as const;

/** The findings of a translation that changes its arguments, tags, and select keys. */
export const TRANSLATION_FINDINGS = [
    {
        file: 'messages/fr.json',
        rule: 'message-arguments',
        message: 'greet: en has {name}, which this message leaves out. This message has {nom}, which en does not have.',
    },
    {
        file: 'messages/fr.json',
        rule: 'message-arguments',
        message:
            'pick: en has {gender, select, female male other}, which this message leaves out. This message has {gender, select, male other}, which en does not have.',
    },
] as const;
