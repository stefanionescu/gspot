import { TRANSLATION_RULES } from '#cli/config/configurations/framework.ts';
import { SYNTAX_EXPLANATIONS } from '#cli/configurations/explanations.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

export const TRANSLATION_EXPLANATIONS = {
    [TRANSLATION_RULES.message]: {
        description: 'Each message parses as an ICU message.',
        why: 'A broken message shows raw text or throws when the app formats it.',
        fix: 'Fix the message syntax, such as an unclosed brace.',
        example: '`"greeting": "Hello {name"` reports `message`.',
    },
    [TRANSLATION_RULES.missingKey]: {
        description: 'Each locale has a message for each key of the base locale.',
        why: 'A missing message shows another language or the bare key to the users of that locale.',
        fix: 'Translate the message into this locale.',
        example: 'A `checkout.title` key in `en.json` and not in `de.json` reports `missing-key`.',
    },
    [TRANSLATION_RULES.extraKey]: {
        description: 'Each key of a locale exists in the base locale.',
        why: 'A key outside the base locale has no source text, and no code asks for it.',
        fix: 'Remove the key from this locale, or add the source text to the base locale.',
        example: 'A `checkout.old_title` key in `de.json` and not in `en.json` reports `extra-key`.',
    },
    [TRANSLATION_RULES.messageArguments]: {
        description: 'A translated message uses the arguments and choice forms of its base message.',
        why: 'A missing or renamed argument drops a value from the text, or fails when the app formats it.',
        fix: 'Use the argument names and choice forms of the base message.',
        example:
            '`{count, plural, ...}` in `en.json` and `{total, plural, ...}` in `de.json` report `message-arguments`.',
    },
    [TRANSLATION_RULES.baseLocale]: {
        description: 'The file of the base locale, such as `en.json`, exists beside the other locale files.',
        why: 'The check compares the keys and arguments of every locale with the base locale.',
        fix: 'Restore the base locale file, or set `translations.base_locale` to the locale that the project writes first.',
        example: 'A `messages/` folder with `de.json` and no `en.json` reports `base-locale`.',
    },
    ...SYNTAX_EXPLANATIONS,
} as const satisfies RuleExplanations;
