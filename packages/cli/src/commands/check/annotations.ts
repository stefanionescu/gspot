import { randomUUID } from 'node:crypto';

import {
    ANNOTATION_ESCAPES,
    ANNOTATION_MESSAGE_CHARACTERS,
    ANNOTATION_PROPERTY_CHARACTERS,
    GITHUB_ANNOTATION_LIMIT,
} from '#cli/config/commands/check.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { print } from '#cli/system/terminal.ts';
import type { CheckCommandJson } from '#cli/types/commands.ts';

/**
Format one GitHub error annotation per finding, up to the number of error annotations that GitHub shows for one step.
The annotations print after the report, once workflow commands run again. The escapes keep tool text from closing a
property or from starting a second command.
*/
export function formatAnnotations(json: CheckCommandJson): string[] {
    if (readEnvironmentVariable('GITHUB_ACTIONS') !== 'true' || 'error' in json) return [];
    const reports = 'revisions' in json ? json.revisions.map(({ report }) => report) : [json];
    const findings = reports.flatMap(({ checks }) => checks.flatMap((check) => check.findings));
    return findings.slice(0, GITHUB_ANNOTATION_LIMIT).map((finding) => {
        const properties = [
            ['file', finding.file === '' ? undefined : finding.file],
            ['line', finding.line === undefined ? undefined : String(finding.line)],
            ['col', finding.column === undefined ? undefined : String(finding.column)],
            ['title', [finding.check, finding.rule].filter((name) => name !== undefined).join(' ')],
        ] as const;
        const fields = properties.flatMap(([name, value]) =>
            value === undefined
                ? []
                : [
                      `${name}=${value.replaceAll(ANNOTATION_PROPERTY_CHARACTERS, (character) => ANNOTATION_ESCAPES[character] ?? character)}`,
                  ],
        );
        const message = finding.message.replaceAll(
            ANNOTATION_MESSAGE_CHARACTERS,
            (character) => ANNOTATION_ESCAPES[character] ?? character,
        );
        return `::error ${fields.join(',')}::${message}`;
    });
}

/**
Stop GitHub workflow command parsing until the check's output has finished.
*/
export function beginCheckReport(): (() => void) | undefined {
    if (readEnvironmentVariable('GITHUB_ACTIONS') !== 'true') return undefined;
    const token = randomUUID();
    print(`::stop-commands::${token}`);
    return () => {
        print(`::${token}::`);
    };
}
