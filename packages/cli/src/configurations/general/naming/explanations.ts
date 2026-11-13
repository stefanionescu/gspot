import { NAMING_RULES } from '#cli/config/configurations/naming.ts';
import { SYNTAX_EXPLANATIONS } from '#cli/configurations/explanations.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

// The page of banned-word prints the lists from the manifest that the check reads, so the two cannot differ.
const SHIPPED_WORD_LISTS = Object.entries(readNamingDefaults().lists)
    .map(([group, list]) => {
        const firstWord = list.first_word === true ? ' as the first word' : '';
        const position = list.whole_name === true ? ' as the whole name' : firstWord;
        const categories = list.categories === undefined ? '' : ` of ${list.categories.join(' and ')}`;
        return `${group.replaceAll('_', ' ')}${position}${categories} (${list.words.join(', ')})`;
    })
    .join('; ');

export const NAMING_EXPLANATIONS = {
    [NAMING_RULES.case]: {
        description: 'A name uses a case that `naming.<language>.<category>.cases` lists.',
        why: 'One case for each kind of name tells a reader what kind of thing the name is.',
        fix: 'Rename it in a listed case.',
        example: 'A TypeScript file `User_Profile.ts` reports `case`; `user-profile.ts` does not.',
    },
    [NAMING_RULES.digits]: {
        description: 'A name holds no digit as a word.',
        why: 'A digit, as in `summary2`, says nothing about how the two values differ.',
        fix: 'Name the difference, or set `allow_digits` in a `[[naming.exception]]` record with a reason.',
        example: '`summary2` reports `digits`; `weeklySummary` does not.',
    },
    [NAMING_RULES.length]: {
        description: 'A name has at most `naming.<language>.max_characters` characters.',
        why: 'A long name is hard to read at each place that uses it.',
        fix: 'Shorten the name, or raise the limit with a reason.',
        example: 'A 40-character TypeScript name, over the default of 35, reports `length`.',
    },
    [NAMING_RULES.words]: {
        description: 'A name has at most `naming.<language>.max_words` words.',
        why: 'A name with many words often joins two concepts.',
        fix: 'Split the code, or name the one concept that it holds.',
        example: '`readUserProfileImageCache` has 5 words, over the TypeScript default of 4, so it reports `words`.',
    },
    [NAMING_RULES.duplicateWords]: {
        description: 'A name repeats no word.',
        why: 'A repeated word, as in `orderOrderLines`, adds no meaning.',
        fix: 'Remove the repeated word, or set `allow_repeated_words` in a `[[naming.exception]]` record.',
        example: '`orderOrderLines` reports `duplicate-words`; `orderLines` does not.',
    },
    [NAMING_RULES.bannedWord]: {
        description: `A name holds no word that \`naming.banned_words\` or a shipped word list bans. The shipped lists are ${SHIPPED_WORD_LISTS}.`,
        why: 'A word such as `manager` or `helper` hides what the code holds or does.',
        fix: 'Choose a word that names the role, or keep the name through `allowed_names` in a `[[naming.exception]]` record.',
        example: '`sessionManager` reports `banned-word`; `sessionStore` does not.',
    },
} as const satisfies RuleExplanations;

export const IDENTIFIER_EXPLANATIONS = {
    ...NAMING_EXPLANATIONS,
    ...SYNTAX_EXPLANATIONS,
} as const satisfies RuleExplanations;
