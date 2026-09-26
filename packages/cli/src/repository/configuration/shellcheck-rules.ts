import type { Directive, Rules } from '#cli/types/repository/repository.ts';
import { DIRECTIVE, RULE_CODE, RULE_NAME } from '#cli/constants/repository/repository.ts';

// Whether a directive key names a rule list.
function isRuleKey(key: string): key is keyof Rules {
    return key === 'enable' || key === 'disable';
}

// Where a quoted value ends, refusing an unterminated or empty quote.
function quotedEnd(text: string, quote: string, lineNumber: number): number {
    const end = text.indexOf(quote, 1);
    if (end === -1) throw new Error(`Unterminated ShellCheck quote on line ${String(lineNumber)}.`);
    if (end === 1) throw new Error(`Empty ShellCheck quote on line ${String(lineNumber)}.`);
    return end;
}

// A directive's value and what follows it: quoted up to the closing quote, or plain up to whitespace.
function valueSpan(afterKey: string, key: string, lineNumber: number): Pick<Directive, 'value' | 'remaining'> {
    const quote = afterKey.slice(0, 1);
    if (quote === '"' || quote === "'") {
        const end = quotedEnd(afterKey, quote, lineNumber);
        return { value: afterKey.slice(1, end), remaining: afterKey.slice(end + 1).trimStart() };
    }
    const end = afterKey.search(isRuleKey(key) ? /[\s#]/u : /\s/u);
    if (end === -1) return { value: afterKey, remaining: '' };
    return { value: afterKey.slice(0, end), remaining: afterKey.slice(end).trimStart() };
}

// The next directive on a line: its key, its plain or quoted value, and what follows it.
function readDirective(text: string, lineNumber: number): Directive {
    const directive = DIRECTIVE.exec(text);
    const key = directive?.[1];
    if (directive === null || key === undefined)
        throw new Error(`Invalid ShellCheck directive on line ${String(lineNumber)}.`);
    return { key, ...valueSpan(text.slice(directive[0].length), key, lineNumber) };
}

// Whether a disable entry is `all`, one code, or a range of two codes.
function isDisableEntry(entry: string): boolean {
    if (entry === 'all') return true;
    const codes = entry.split('-');
    return codes.length <= 2 && codes.every((code) => RULE_CODE.test(code));
}

// A disable entry with every code in ShellCheck's canonical SC form.
function canonicalCodes(entry: string): string {
    return entry.replaceAll(/(?:SC)?(\d+)/gu, (_, code: string) => `SC${String(Number(code))}`);
}

// The entries of a rule list, checked against the form the key accepts.
function ruleEntries(key: keyof Rules, value: string, lineNumber: number): string[] {
    const entries = value === '' ? [] : value.split(',');
    const isValid = key === 'enable' ? (entry: string) => RULE_NAME.test(entry) : isDisableEntry;
    if (!entries.every((entry) => isValid(entry)))
        throw new Error(`Invalid ShellCheck ${key} list on line ${String(lineNumber)}.`);
    return key === 'disable' ? entries.map((entry) => canonicalCodes(entry)) : entries;
}

/**
 * Read ShellCheck rule directives without executing configuration or resolving source paths.
 * @param text the configuration text
 * @returns the enabled and disabled rule codes
 */
export function shellcheckRules(text: string): Rules {
    const rules: Rules = { enable: [], disable: [] };
    for (const [index, line] of text.split(/\r?\n/u).entries()) {
        let remaining = line.trimStart();
        while (remaining !== '' && !remaining.startsWith('#')) {
            const directive = readDirective(remaining, index + 1);
            remaining = directive.remaining;
            if (isRuleKey(directive.key))
                rules[directive.key].push(...ruleEntries(directive.key, directive.value, index + 1));
        }
    }
    return rules;
}
