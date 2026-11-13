import {
    BANNED_WORD_FORMS,
    CAMEL_ACRONYM_WORD,
    CAMEL_WORD,
    CATEGORY_LABELS,
    DIGIT,
    DIGITS_ONLY,
    LAST_EXTENSION,
    LOWER_WORD,
    NAMING_RULES,
    NUMERIC_WORDS,
    PASCAL_ACRONYM_WORD,
    PASCAL_WORD,
    RUFF_CATEGORIES,
    SILENT_E,
    SWIFTLINT_CATEGORIES,
    TEST_WORD_LIST,
    TRAILING_Y,
    UPPER_WORD,
    VOWEL_SUFFIX,
    WORD_FORM_CONSONANT,
    WORD_FORM_SUFFIXES,
} from '#cli/config/configurations/naming.ts';
import { SQL_EXTENSION } from '#cli/config/configurations/shared.ts';
import { splitWords } from '#cli/configurations/general/naming/words.ts';
import { formatNameList } from '#cli/system/text/messages.ts';
import type {
    BannedWord,
    CategoryLimits,
    CheckedIdentifier,
    CompiledException,
    FileNaming,
    Identifier,
    NamingCase,
    NamingSettings,
} from '#cli/types/configurations/naming.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';

function isSnakeMigration(name: string): boolean {
    if (!name.endsWith(SQL_EXTENSION)) return false;
    const [sequence = '', ...words] = name.slice(0, -SQL_EXTENSION.length).split('_');
    return DIGITS_ONLY.test(sequence) && words.length > 0 && words.every((word) => LOWER_WORD.test(word));
}

const CASE_TESTS = {
    camel: (name) => CAMEL_WORD.test(name),
    'camel-acronym': (name) => CAMEL_ACRONYM_WORD.test(name),
    pascal: (name) => PASCAL_WORD.test(name),
    'pascal-acronym': (name) => PASCAL_ACRONYM_WORD.test(name),
    'pascal-extension': (name) => name.includes('+') && name.split('+').every((word) => PASCAL_ACRONYM_WORD.test(word)),
    kebab: (name) => name !== '' && name.split('-').every((word) => LOWER_WORD.test(word)),
    snake: (name) => name !== '' && name.split('_').every((word) => LOWER_WORD.test(word)),
    'upper-snake': (name) => name !== '' && name.split('_').every((word) => UPPER_WORD.test(word)),
    'timestamp-snake': isSnakeMigration,
} satisfies Record<NamingCase, (name: string) => boolean>;

function isInflectedForm(word: string, base: string): boolean {
    if (word === base) return true;
    if (
        base.endsWith(SILENT_E) &&
        WORD_FORM_SUFFIXES.some((suffix) => VOWEL_SUFFIX.test(suffix) && word === base.slice(0, -1) + suffix)
    )
        return true;
    if (base.endsWith(TRAILING_Y) && ['ies', 'ied'].some((suffix) => word === base.slice(0, -1) + suffix)) return true;
    const forms = WORD_FORM_CONSONANT.test(base) ? [base, base + (base.at(-1) as string)] : [base];
    return forms.some((form) => WORD_FORM_SUFFIXES.some((suffix) => word === form + suffix));
}

function isWordForm(word: string, term: string): boolean {
    const bases = BANNED_WORD_FORMS[term] ?? [term];
    return bases.some((base) => isInflectedForm(word, base));
}

function hasTerm(words: string[], term: BannedWord): boolean {
    if (term.wholeName === true && words.length !== term.words.length) return false;
    const lastStart = term.firstWord === true ? 0 : words.length - term.words.length;
    for (let start = 0; start <= lastStart && start + term.words.length <= words.length; start += 1) {
        if (term.words.every((termWord, index) => isWordForm(words[start + index] as string, termWord))) return true;
    }
    return false;
}

function stripPrefixes(identifier: Identifier, exceptions: CompiledException[]): string {
    const { name } = identifier;
    let result = identifier.ignoredPrefix === undefined ? name : name.replace(identifier.ignoredPrefix, '');
    for (const exception of exceptions)
        if (exception.ignoredPrefix !== undefined) result = result.replace(exception.ignoredPrefix, '');
    return result === '' ? name : result;
}

function validateCase(checked: CheckedIdentifier, name: string, limits: CategoryLimits) {
    if (limits.cases.length === 0) return undefined;
    const isFileName = checked.identifier.category === 'files';
    const isMatched = limits.cases.some((caseName) => {
        if (caseName === 'timestamp-snake') return CASE_TESTS[caseName](name);
        const subject = isFileName ? name.replace(LAST_EXTENSION, '') : name;
        return [subject, checked.identifier.name].some((text) =>
            text.split('.').every((segment) => CASE_TESTS[caseName](segment)),
        );
    });
    return isMatched
        ? undefined
        : {
              ...checked.place,
              rule: NAMING_RULES.case,
              message: `${checked.prefix}expected ${formatNameList(limits.cases, 'disjunction')} case.`,
          };
}

function validateDigits(checked: CheckedIdentifier, words: string[], exceptions: CompiledException[]) {
    if (
        words.every((segment) => !DIGIT.test(segment) || NUMERIC_WORDS.has(segment)) ||
        exceptions.some((exception) => exception.digitsAllowed)
    )
        return undefined;
    return {
        ...checked.place,
        rule: NAMING_RULES.digits,
        message: `${checked.prefix}a digit is not a word.`,
    };
}

function validateLength(checked: CheckedIdentifier, name: string, limits: CategoryLimits) {
    if (limits.maxCharacters <= 0 || name.length <= limits.maxCharacters) return undefined;
    return {
        ...checked.place,
        rule: NAMING_RULES.length,
        message: `${checked.prefix}${String(name.length)} characters is over the limit of ${String(limits.maxCharacters)}.`,
    };
}

function validateWordCount(checked: CheckedIdentifier, words: string[], limits: CategoryLimits) {
    if (limits.maxWords <= 0 || words.length <= limits.maxWords) return undefined;
    return {
        ...checked.place,
        rule: NAMING_RULES.words,
        message: `${checked.prefix}${String(words.length)} words is over the limit of ${String(limits.maxWords)}.`,
    };
}

function validateRepeatedWords(checked: CheckedIdentifier, words: string[], exceptions: CompiledException[]) {
    if (exceptions.some((exception) => exception.repeatedWordsAllowed)) return undefined;
    const repeated = findRepeatedWord(words);
    return repeated === undefined
        ? undefined
        : {
              ...checked.place,
              rule: NAMING_RULES.duplicateWords,
              message: `${checked.prefix}"${repeated}" repeats.`,
          };
}

function isPhraseAt(words: string[], index: number, phrase: string[]): boolean {
    const end = index + phrase.length;
    return (
        end <= words.length &&
        phrase.every((word, offset) =>
            offset === phrase.length - 1
                ? isWordForm(words[index + offset] as string, word)
                : words[index + offset] === word,
        )
    );
}

function removePhrase(words: string[], phrase: string[]): string[] {
    const remaining: string[] = [];
    let index = 0;
    while (index < words.length) {
        if (isPhraseAt(words, index, phrase)) index += phrase.length;
        else {
            remaining.push(words[index] as string);
            index += 1;
        }
    }
    return remaining;
}

function removeAllowedPhrases(sourceWords: string[], phrases: string[][]): string[] {
    let words = sourceWords;
    for (const phrase of phrases) words = removePhrase(words, phrase);
    return words;
}

function validateBannedWords(checked: CheckedIdentifier, nameWords: string[]): CheckFinding | undefined {
    const { settings } = checked;
    const terms = checked.isTestFile
        ? settings.bannedWords.filter((term) => term.list !== TEST_WORD_LIST)
        : settings.bannedWords;
    const words = removeAllowedPhrases(nameWords, settings.allowedPhrases);
    const banned = terms.find(
        (term) =>
            (term.categories === undefined || term.categories.includes(checked.identifier.category)) &&
            // A whole-name term reads the name before its allowed phrases leave, so `runPackageManager` is not `run`.
            hasTerm(term.wholeName === true ? nameWords : words, term),
    );
    if (banned === undefined) return undefined;
    const advice = banned.replacement === undefined ? '' : ` Use "${banned.replacement}".`;
    return {
        ...checked.place,
        rule: NAMING_RULES.bannedWord,
        message: `${checked.prefix}"${banned.word}" is banned (${banned.setting}).${advice}`,
    };
}

function findRepeatedWord(words: string[]): string | undefined {
    const seen = new Set<string>();
    for (const segment of words) {
        if (seen.has(segment)) return segment;
        seen.add(segment);
    }
    return undefined;
}

function selectExceptions(settings: NamingSettings, identifier: Identifier): CompiledException[] {
    const path = identifier.folder ?? identifier.file;
    return settings.exceptions.filter(
        (exception) =>
            exception.matches(path) &&
            (exception.languages === undefined || exception.languages.has(identifier.language)) &&
            (exception.categories === undefined || exception.categories.has(identifier.category)),
    );
}

function buildIdentifierLimits(
    settings: NamingSettings,
    identifier: Identifier,
    exceptions: CompiledException[],
): CategoryLimits {
    const base = settings.limitLookup(identifier.language, identifier.category);
    if (identifier.language === 'python' && RUFF_CATEGORIES.has(identifier.category)) return { ...base, cases: [] };
    const caseException = exceptions.findLast((exception) => exception.cases !== undefined);
    return identifier.language === 'swift' && SWIFTLINT_CATEGORIES.has(identifier.category)
        ? { ...base, cases: [], maxCharacters: 0 }
        : { ...base, cases: [...new Set([...(caseException?.cases ?? base.cases), ...(identifier.addedCases ?? [])])] };
}

function validateIdentifier(identifier: Identifier, naming: FileNaming): CheckFinding[] {
    const context: CheckedIdentifier = {
        ...naming,
        identifier,
        place: { file: identifier.file, line: identifier.line, column: identifier.column },
        prefix: `${identifier.language} ${CATEGORY_LABELS[identifier.category]} "${identifier.name}": `,
    };
    const { settings } = naming;
    const exceptions = selectExceptions(settings, identifier);
    if (
        exceptions.some(
            (exception) =>
                exception.allowedNames?.has(identifier.name) === true ||
                exception.ignoredNames?.test(identifier.name) === true,
        )
    )
        return [];
    const limits = buildIdentifierLimits(settings, identifier, exceptions);
    const name = stripPrefixes(identifier, exceptions);
    const nameWords = splitWords(name);
    const words = splitWords(name.split('.', 1)[0] ?? name).filter((segment) => !DIGITS_ONLY.test(segment));
    const findings = [
        validateCase(context, name, limits),
        validateDigits(context, nameWords, exceptions),
        validateLength(context, name, limits),
        validateWordCount(context, words, limits),
        validateRepeatedWords(context, words, exceptions),
        validateBannedWords(context, nameWords),
    ];
    return findings.filter((finding) => finding !== undefined);
}

export function validateIdentifiers(settings: NamingSettings, identifiers: Identifier[]): CheckFinding[] {
    return identifiers.flatMap((identifier) =>
        validateIdentifier(identifier, { settings, isTestFile: settings.isTestFile(identifier.file) }),
    );
}
