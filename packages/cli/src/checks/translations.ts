import { posix } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { readParsedFile } from '#cli/checks/syntax.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { messagesSchema } from '#cli/schemas/checks/translations.ts';
import type { MessageFiles } from '#cli/types/checks/translations.ts';
import { ARGUMENT_FORMATS, MESSAGE_FILE_SUFFIX } from '#cli/config/checks/translations.ts';
import { TYPE, parse, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

function flattenMessages(value: unknown, prefix = ''): Map<string, string> {
    if (value === null || typeof value !== 'object') return new Map();
    const pairs = Object.entries(value).flatMap(([key, child]): [string, string][] => {
        const name = prefix === '' ? key : `${prefix}.${key}`;
        return typeof child === 'string' ? [[name, child]] : flattenMessages(child, name).entries().toArray();
    });
    return new Map(pairs);
}

function validateMessage(text: string): string | undefined {
    if (text.trim() === '') return 'The message is empty.';
    try {
        parse(text);
        return undefined;
    } catch (error) {
        return `The message does not parse: ${error instanceof Error ? error.message : 'a syntax error'}.`;
    }
}

function findBaseFile(path: string, messageFiles: MessageFiles): string {
    const { folder, base, paths } = messageFiles;
    const sibling = posix.join(posix.dirname(path), `${base}${MESSAGE_FILE_SUFFIX}`);
    const [, ...rest] = posix.relative(folder, path).split('/');
    if (paths.has(sibling) || rest.length === 0) return sibling;
    const nested = posix.join(folder, base, ...rest);
    const hasBaseFolder = [...paths].some((each) => each.startsWith(`${posix.join(folder, base)}/`));
    return paths.has(nested) || hasBaseFolder ? nested : sibling;
}

function compareMessages(
    planned: PlannedCheck,
    path: string,
    messages: Map<string, string>,
    baseMessages: Map<string, string>,
): Finding[] {
    const base = getTable(planned.scope.settings, 'translations').base_locale;
    const broken = [...messages].flatMap(([key, text]) => {
        const message = validateMessage(text);
        return message === undefined
            ? []
            : [buildFinding(planned, { file: path, line: 1 }, 'message', `${key}: ${message}`)];
    });
    const missing = [...baseMessages.keys()]
        .filter((key) => !messages.has(key))
        .map((key) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'missing-key',
                `The key ${key} of ${base} has no message here.`,
            ),
        );
    const changed = [...messages].flatMap(([key, text]) => {
        const baseText = baseMessages.get(key);
        const message = baseText === undefined ? undefined : compareMessageArguments(text, baseText, base);
        return message === undefined
            ? []
            : [buildFinding(planned, { file: path, line: 1 }, 'message-arguments', `${key}: ${message}`)];
    });
    return [...broken, ...missing, ...changed];
}

function listArgumentNames(elements: MessageFormatElement[]): string[] {
    return elements.flatMap((element): string[] => {
        if (element.type === TYPE.literal || element.type === TYPE.pound) return [];
        if (element.type === TYPE.tag) return [`<${element.value}>`, ...listArgumentNames(element.children)];
        if (element.type === TYPE.select || element.type === TYPE.plural) {
            const keys =
                element.type === TYPE.select
                    ? `, select, ${Object.keys(element.options)
                          .toSorted((left, right) => compareText(left, right))
                          .join(' ')}`
                    : ', plural';
            const nested = Object.values(element.options).flatMap((option) => listArgumentNames(option.value));
            return [`{${element.value}${keys}}`, ...nested];
        }
        const format = ARGUMENT_FORMATS[element.type];
        return [`{${element.value}${format}}`];
    });
}

function compareMessageArguments(text: string, baseText: string, base: string): string | undefined {
    let argumentNames: Set<string>;
    let baseArgumentNames: Set<string>;
    try {
        argumentNames = new Set(listArgumentNames(parse(text)));
        baseArgumentNames = new Set(listArgumentNames(parse(baseText)));
    } catch {
        return undefined;
    }
    const missing = [...baseArgumentNames].filter((argumentName) => !argumentNames.has(argumentName));
    const unexpected = [...argumentNames].filter((segment) => !baseArgumentNames.has(segment));
    if (missing.length === 0 && unexpected.length === 0) return undefined;
    return [
        missing.length === 0 ? '' : `${base} has ${missing.join(', ')}, which this message leaves out.`,
        unexpected.length === 0 ? '' : `This message has ${unexpected.join(', ')}, which ${base} does not have.`,
    ]
        .filter(Boolean)
        .join(' ');
}

function readMessageFiles(
    session: Session,
    planned: PlannedCheck,
    files: string[],
    messageFiles: MessageFiles,
): { messagesByPath: Map<string, Map<string, string>>; findings: Finding[] } {
    const messagesByPath = new Map<string, Map<string, string>>();
    const findings: Finding[] = [];
    const paths = new Set([...files, ...files.map((file) => findBaseFile(file, messageFiles))]);
    for (const path of [...paths].filter((each) => messageFiles.paths.has(each))) {
        const messages = readParsedFile(planned, path, () =>
            flattenMessages(parseJsonFile(path, readCachedText(session.reads, path), messagesSchema)),
        );
        if ('error' in messages) findings.push(messages.error);
        else messagesByPath.set(path, messages.value);
    }
    return { messagesByPath, findings };
}

/**
Checks the message files in `translations.messages_folder` against the base locale. Each folder of message files, and each
namespace of a locale-folder layout, compares with its own base-locale file.

@param session the repository and its tools.
@param planned the scope files and translation settings.
@returns the findings.
*/
export function checkTranslationsMessages(session: Session, planned: PlannedCheck): Finding[] {
    const options = getTable(planned.scope.settings, 'translations');
    const folder = options.messages_folder as string;
    const base = options.base_locale;
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
    const isMessageFile = (path: string): boolean =>
        path.startsWith(`${folder}/`) && path.endsWith(MESSAGE_FILE_SUFFIX);
    const files = planned.files.map((file) => file.path).filter((path) => isMessageFile(path));
    const messageFiles = {
        folder,
        base,
        paths: new Set(session.repository.files.map((file) => file.path).filter((path) => isMessageFile(path))),
    };
    const { messagesByPath, findings } = readMessageFiles(session, planned, files, messageFiles);
    if (findings.length > 0) return findings;
    const expected =
        files.length === 0
            ? [posix.join(folder, `${base}${MESSAGE_FILE_SUFFIX}`)]
            : files.map((file) => findBaseFile(file, messageFiles));
    const absent = [...new Set(expected)].filter((path) => !messagesByPath.has(path));
    if (absent.length > 0)
        return absent.map((path) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'base-locale',
                `The base locale ${base}${MESSAGE_FILE_SUFFIX} is missing from ${posix.dirname(path)}. Restore it or choose the intended base locale.`,
            ),
        );
    return files.flatMap((path) => {
        const basePath = findBaseFile(path, messageFiles);
        const messages = messagesByPath.get(path);
        const baseMessages = messagesByPath.get(basePath);
        if (messages === undefined || baseMessages === undefined)
            throw new Error(`Missing parsed messages for ${path} or ${basePath}.`);
        return compareMessages(planned, path, messages, baseMessages);
    });
}
