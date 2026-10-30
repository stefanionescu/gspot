import { posix } from 'node:path';
import { read } from '#cli/system/files/reads.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { parseTree, findNodeAtLocation } from 'jsonc-parser';
import { getPosition, compareText } from '#cli/system/text.ts';
import { messagesSchema } from '#cli/schemas/checks/library.ts';
import { parseCheckedFile } from '#cli/checks/cross-configuration/syntax.ts';
import type { MessageFiles, ParsedMessage } from '#cli/types/checks/library.ts';
import { TYPE, parse, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

import {
    RULES,
    EMPTY_MESSAGE,
    PLURAL_FORMAT,
    ARGUMENT_FORMATS,
    MESSAGE_FILE_SUFFIX,
} from '#cli/config/checks/library.ts';

function flattenMessages(value: unknown, prefix = ''): Map<string, string> {
    if (value === null || typeof value !== 'object') return new Map();
    const pairs = Object.entries(value).flatMap(([key, child]): [string, string][] => {
        const name = prefix === '' ? key : `${prefix}.${key}`;
        return typeof child === 'string' ? [[name, child]] : flattenMessages(child, name).entries().toArray();
    });
    return new Map(pairs);
}

function parseMessage(text: string, line: number): ParsedMessage {
    try {
        return { line, elements: parse(text), error: text.trim() === '' ? EMPTY_MESSAGE : undefined };
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        return {
            line,
            elements: undefined,
            error: `The message does not parse: ${error.message}.`,
        };
    }
}

function selectBaseFile(path: string, messageFiles: MessageFiles): string {
    const { folder, base, paths } = messageFiles;
    const sibling = posix.join(posix.dirname(path), `${base}${MESSAGE_FILE_SUFFIX}`);
    const [, ...rest] = posix.relative(folder, path).split('/');
    if (rest.length === 0 || paths.has(sibling)) return sibling;
    const nested = posix.join(folder, base, ...rest);
    const hasBaseFolder = [...paths].some((each) => each.startsWith(`${posix.join(folder, base)}/`));
    return hasBaseFolder || paths.has(nested) ? nested : sibling;
}

function listLocalMessageFindings(
    planned: PlannedCheck,
    path: string,
    messages: Map<string, ParsedMessage>,
    baseMessages: Map<string, ParsedMessage>,
): { broken: CheckFinding[]; unexpected: CheckFinding[] } {
    const broken = [...messages].flatMap(([key, { error, line }]) =>
        error === undefined
            ? []
            : [
                  {
                      file: path,
                      line,
                      rule: RULES.message,
                      message: `${key}: ${error}`,
                  },
              ],
    );
    const base = getTable(planned.scope.settings, 'translations').base_locale;
    const unexpected = [...messages].flatMap(([key, { line }]) =>
        baseMessages.has(key)
            ? []
            : [
                  {
                      file: path,
                      line,
                      rule: RULES.extraKey,
                      message: `The key ${key} is not in ${base}; delete it or add it to the base locale.`,
                  },
              ],
    );
    return { broken, unexpected };
}

function compareMessages(
    planned: PlannedCheck,
    path: string,
    messages: Map<string, ParsedMessage>,
    baseMessages: Map<string, ParsedMessage>,
): CheckFinding[] {
    const base = getTable(planned.scope.settings, 'translations').base_locale;
    const { broken, unexpected } = listLocalMessageFindings(planned, path, messages, baseMessages);
    const missing = baseMessages
        .keys()
        .filter((key) => !messages.has(key))
        .map((key) => ({
            file: path,
            line: 1,
            rule: RULES.missingKey,
            message: `The key ${key} of ${base} has no message here.`,
        }))
        .toArray();
    const changed = [...messages].flatMap(([key, { elements, line }]) => {
        const baseElements = baseMessages.get(key)?.elements;
        const message =
            elements === undefined || baseElements === undefined
                ? undefined
                : compareMessageArguments(elements, baseElements, base);
        return message === undefined
            ? []
            : [
                  {
                      file: path,
                      line,
                      rule: RULES.messageArguments,
                      message: `${key}: ${message}`,
                  },
              ];
    });
    return [...broken, ...missing, ...changed, ...unexpected];
}

function listArgumentNames(elements: MessageFormatElement[], enclosing: ReadonlySet<string> = new Set()): string[] {
    const visible = elements.filter((element) => element.type !== TYPE.argument || !enclosing.has(element.value));
    return visible.flatMap((element): string[] => {
        if (element.type === TYPE.literal) return [];
        if (element.type === TYPE.pound) return [];
        if (element.type === TYPE.tag) return [`<${element.value}>`, ...listArgumentNames(element.children, enclosing)];
        if (element.type === TYPE.select || element.type === TYPE.plural) {
            const keys =
                element.type === TYPE.select
                    ? `, select, ${Object.keys(element.options)
                          .toSorted((left, right) => compareText(left, right))
                          .join(' ')}`
                    : PLURAL_FORMAT;
            const nested = Object.values(element.options).flatMap((option) =>
                listArgumentNames(option.value, new Set([...enclosing, element.value])),
            );
            return [`{${element.value}${keys}}`, ...nested];
        }
        const format = ARGUMENT_FORMATS[element.type];
        return [`{${element.value}${format}}`];
    });
}

function compareMessageArguments(
    elements: MessageFormatElement[],
    baseElements: MessageFormatElement[],
    base: string,
): string | undefined {
    const argumentNames = new Set(listArgumentNames(elements));
    const baseArgumentNames = new Set(listArgumentNames(baseElements));
    const missing = baseArgumentNames.difference(argumentNames).values().toArray();
    const unexpected = argumentNames.difference(baseArgumentNames).values().toArray();
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

    files: string[],
    messageFiles: MessageFiles,
): { messagesByPath: Map<string, Map<string, ParsedMessage>>; findings: CheckFinding[] } {
    const messagesByPath = new Map<string, Map<string, ParsedMessage>>();
    const findings: CheckFinding[] = [];
    const paths = new Set([...files, ...files.map((file) => selectBaseFile(file, messageFiles))]);
    for (const path of paths) {
        if (!messageFiles.paths.has(path)) continue;
        const text = read(session.cache, path);
        const tree = parseTree(text);
        const messages = parseCheckedFile(path, () => flattenMessages(parseJsonFile(path, text, messagesSchema)));
        if ('error' in messages) findings.push(messages.error);
        else
            messagesByPath.set(
                path,
                new Map(
                    messages.value
                        .entries()
                        .map(([key, message]) => [
                            key,
                            parseMessage(
                                message,
                                getPosition(
                                    text,
                                    tree === undefined
                                        ? 0
                                        : (findNodeAtLocation(tree, key.split('.'))?.parent?.offset ?? 0),
                                ).line,
                            ),
                        ]),
                ),
            );
    }
    return { messagesByPath, findings };
}

/**
Checks the message files in `translations.messages_folder` against the base locale. Each folder of message files, and each
namespace of a locale-folder layout, compares with its own base-locale file.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export function checkMessages(session: Session, planned: PlannedCheck): CheckFinding[] {
    const options = getTable(planned.scope.settings, 'translations');
    const folder = options.messages_folder as string;
    const base = options.base_locale;

    const files = planned.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${folder}/`) && path.endsWith(MESSAGE_FILE_SUFFIX));
    const messageFiles = {
        folder,
        base,
        paths: new Set(
            session.repository.files
                .map((file) => file.path)
                .filter((path) => path.startsWith(`${folder}/`) && path.endsWith(MESSAGE_FILE_SUFFIX)),
        ),
    };
    const { messagesByPath, findings } = readMessageFiles(session, files, messageFiles);
    const expected =
        files.length === 0
            ? [posix.join(folder, `${base}${MESSAGE_FILE_SUFFIX}`)]
            : files.map((file) => selectBaseFile(file, messageFiles));
    const absent = [...new Set(expected)].filter((path) => !messageFiles.paths.has(path));
    findings.push(
        ...absent.map((path) => ({
            file: path,
            line: 1,
            rule: RULES.baseLocale,
            message: `The base locale ${base}${MESSAGE_FILE_SUFFIX} is missing from ${posix.dirname(path)}. Restore it or choose the intended base locale.`,
        })),
    );
    return [
        ...findings,
        ...files.flatMap((path) => {
            const basePath = selectBaseFile(path, messageFiles);
            const messages = messagesByPath.get(path);
            const baseMessages = messagesByPath.get(basePath);
            if (messages === undefined || baseMessages === undefined) return [];
            return compareMessages(planned, path, messages, baseMessages);
        }),
    ];
}
