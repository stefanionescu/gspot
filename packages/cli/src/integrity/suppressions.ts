// Every inline suppression is counted by form, and one without a reason is a finding of its own.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import type { TrackedFile } from '#types/repository.ts';
import { SUPPRESSION_FORMS } from '#config/integrity.ts';
import type { SuppressionForm } from '#types/integrity.ts';
import { COMMENT_OPENERS, COMMENT_STYLE_BY_EXTENSION } from '#config/markers.ts';

function styleOf(file: TrackedFile): string | undefined {
    const dot = file.path.lastIndexOf('.');
    return dot === -1 ? undefined : COMMENT_STYLE_BY_EXTENSION[file.path.slice(dot)];
}

// Whether an opener at this index sits inside a string literal: an odd count of a quote character before it.
function isQuoted(line: string, index: number): boolean {
    const before = line.slice(0, index);
    return ["'", '"', '`'].some((quote) => before.split(quote).length % 2 === 0);
}

// The comment part of a line: from the first comment opener outside a string literal on; code before it holds no directive.
function commentOf(line: string, style: string): string | undefined {
    const starts = (COMMENT_OPENERS[style] ?? [])
        .map((opener) => line.indexOf(opener))
        .filter((index) => index !== -1 && !isQuoted(line, index));
    return starts.length === 0 ? undefined : line.slice(Math.min(...starts));
}

function findingFor(input: EngineInput, file: string, line: number, form: SuppressionForm, text: string): Finding {
    const base = { check: input.spec.name, file, line, fixable: false };
    if (form.isForbidden === true)
        return {
            ...base,
            rule: form.form,
            message: `${form.form} is not allowed; fix the finding or exclude the path with a reason.`,
        };
    if (!form.reason.test(text))
        return { ...base, rule: `${form.form}-no-reason`, message: `This ${form.form} carries no reason.` };
    return {
        ...base,
        rule: form.form,
        message: `${form.form} suppression (counted; the census never grows without a baseline update).`,
    };
}

function lineFindings(
    input: EngineInput,
    file: string,
    number: number,
    text: string,
    forms: SuppressionForm[],
): Finding[] {
    return forms.filter((form) => form.marker.test(text)).map((form) => findingFor(input, file, number, form, text));
}

function fileFindings(input: EngineInput, file: TrackedFile, style: string, forms: SuppressionForm[]): Finding[] {
    const lines = readFileSync(join(input.root, file.path), 'utf8').split('\n');
    return lines.flatMap((line, index) => {
        const text = commentOf(line, style);
        return text === undefined ? [] : lineFindings(input, file.path, index + 1, text, forms);
    });
}

/**
 * One finding per inline suppression: its form for the census, and a no-reason rule when the reason is missing. The tree is one, so the root scope reports.
 * @param input the engine input
 * @returns the findings
 */
export function suppressions(input: EngineInput): Promise<Finding[]> {
    const findings = input.session.repository.files
        .filter((file) => file.nature === 'source' && file.tags.includes('text'))
        .flatMap((file) => {
            const style = styleOf(file) ?? '';
            const forms = SUPPRESSION_FORMS[style];
            return forms === undefined ? [] : fileFindings(input, file, style, forms);
        });
    return Promise.resolve(findings);
}
