import { NEXT_MESSAGES } from '#tests/config/samples/nextjs.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InProcessScenario } from '#tests/types/harness/repository.ts';

/** The translations settings naming the message directory and base locale. */
export const NEXT_TRANSLATIONS = '[translations]\nmessages_folder = "messages"\nbase_locale = "en"\n';

export const REPOSITORY: InProcessScenario = {
    configurations: ['translations'],
    dependencies: { 'next-intl': '4.3.9' },
    files: NEXT_MESSAGES,
};

export const CASES: FindingCase[] = [
    {
        check: 'translations/locales',
        files: { 'messages/de.json': '{\n    "home": { "title": "Start" }\n}\n' },
        policy: NEXT_TRANSLATIONS,
        expected: { file: 'messages/de.json', rule: 'missing-key', line: 1 },
    },
    {
        check: 'translations/locales',
        files: { 'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name" }\n}\n' },
        policy: NEXT_TRANSLATIONS,
        expected: { file: 'messages/de.json', rule: 'message', line: 1 },
    },
];
