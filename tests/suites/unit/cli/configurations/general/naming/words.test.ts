import { test, expect } from 'bun:test';
import { splitWords } from '#cli/configurations/general/naming/words.ts';

test.each([
    ['HTMLParser', ['html', 'parser']],
    ['user_id', ['user', 'id']],
    ['handlerV2', ['handler', 'v', '2']],
    ['decodeBase64', ['decode', 'base64']],
    ['I18N', ['i18n']],
] as const)(
    'splitWords splits %s at case changes, separators, and digit runs, and keeps an acronym or a number word as one word',
    (name, words) => {
        expect(splitWords(name)).toStrictEqual([...words]);
    },
);
