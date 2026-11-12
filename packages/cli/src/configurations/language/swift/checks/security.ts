import type { Node } from 'web-tree-sitter';

import {
    LOG_FUNCTIONS,
    LOG_METHODS,
    PLIST_READ_EXPRESSION,
    PRIVACY_LABEL,
    PUBLIC_PRIVACY,
    SECRET_PLIST_KEY,
    SECRET_VALUE,
    SECRET_WORD,
    SWIFT_SECRET_FINDINGS,
    SWIFT_SECURITY_RULES,
    UNSAFE_SWIFT_NAMES,
    USER_DEFAULTS_DECLARATION,
    USER_DEFAULTS_RECEIVER,
} from '#cli/config/configurations/swift.ts';
import { SWIFT_SECURITY_EXPLANATIONS } from '#cli/configurations/language/swift/explanations.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';
import { listSwiftCallArguments } from '#cli/parsers/code/swift.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

const SQLITE_FUNCTIONS: ReadonlySet<string> = new Set([
    'sqlite3_exec',
    'sqlite3_prepare',
    'sqlite3_prepare_v2',
    'sqlite3_prepare_v3',
    'sqlite3_prepare16',
    'sqlite3_prepare16_v2',
    'sqlite3_prepare16_v3',
]);

const SQL_INTERPOLATION_FINDING = {
    rule: SWIFT_SECURITY_RULES.sqlInterpolation,
    message: 'Write `?` in the SQL text, and pass the value with a `sqlite3_bind` function.',
};

function listCallValues(call: Node): Node[] {
    return listSwiftCallArguments(call).flatMap((node) => node.childForFieldName('value') ?? []);
}

function getMethodCall(call: Node): { receiver: string; name: string } | undefined {
    const callee = call.firstNamedChild;
    if (callee?.type !== 'navigation_expression') return undefined;
    return { receiver: callee.firstNamedChild?.text ?? '', name: callee.lastNamedChild?.lastNamedChild?.text ?? '' };
}

function isExposed(interpolation: Node): boolean {
    const option = interpolation.nextNamedSibling;
    const privacy =
        option?.type === 'interpolated_expression' && option.firstNamedChild?.text === PRIVACY_LABEL
            ? option.lastNamedChild?.text
            : undefined;
    return SECRET_VALUE.test(interpolation.text) && (privacy === undefined || privacy === PUBLIC_PRIVACY);
}

function isSecretLog(call: Node): boolean {
    const callee = call.firstNamedChild?.text ?? '';
    if (!LOG_FUNCTIONS.has(callee) && !LOG_METHODS.has(getMethodCall(call)?.name ?? '')) return false;
    return listCallValues(call).some((value) =>
        value.type.endsWith('string_literal')
            ? value.namedChildren.some((child) => child.type === 'interpolated_expression' && isExposed(child))
            : SECRET_VALUE.test(value.text),
    );
}

function isSecretDefault(call: Node, defaults: Set<string>): boolean {
    const method = getMethodCall(call);
    if (method?.name !== 'set' || !(USER_DEFAULTS_RECEIVER.test(method.receiver) || defaults.has(method.receiver)))
        return false;
    return listCallValues(call).some(
        (value) => value.parent?.childForFieldName('name')?.text === 'forKey' && SECRET_WORD.test(value.text),
    );
}

function listSecretNodes(syntaxRoot: Node, source: string): Array<readonly [Node, { rule: string; message: string }]> {
    const defaults = new Set(source.matchAll(USER_DEFAULTS_DECLARATION).map((declaration) => declaration[1] ?? ''));
    return syntaxRoot.descendantsOfType('call_expression').flatMap((call) => {
        if (isSecretLog(call)) return [[call, SWIFT_SECRET_FINDINGS.log] as const];
        if (isSecretDefault(call, defaults)) return [[call, SWIFT_SECRET_FINDINGS.defaults] as const];
        const isPlistRead = PLIST_READ_EXPRESSION.test(call.firstNamedChild?.text ?? '');
        return isPlistRead && listCallValues(call).some((value) => SECRET_PLIST_KEY.test(value.text))
            ? [[call, SWIFT_SECRET_FINDINGS.plist] as const]
            : [];
    });
}

function listInterpolatedQueries(syntaxRoot: Node): Array<readonly [Node, { rule: string; message: string }]> {
    return syntaxRoot
        .descendantsOfType('call_expression')
        .flatMap((call) =>
            SQLITE_FUNCTIONS.has(call.firstNamedChild?.text ?? '') &&
            listCallValues(call).some(
                (value) =>
                    value.type.endsWith('string_literal') &&
                    value.namedChildren.some((child) => child.type === 'interpolated_expression'),
            )
                ? [[call, SQL_INTERPOLATION_FINDING] as const]
                : [],
        );
}

async function checkSwiftSecurity(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: CheckFinding[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        const names = source.rootNode
            .descendantsOfType(['simple_identifier', 'navigation_expression'])
            .flatMap((node) => {
                const unsafe = UNSAFE_SWIFT_NAMES.get(node.text);
                return unsafe === undefined ? [] : [[node, unsafe] as const];
            });
        for (const [node, finding] of [
            ...names,
            ...listSecretNodes(source.rootNode, source.text),
            ...listInterpolatedQueries(source.rootNode),
        ])
            findings.push({
                file: source.path,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
                ...finding,
            });
    });
    return findings;
}

export const SWIFT_SECURITY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'swift/security': { check: checkSwiftSecurity, explanations: SWIFT_SECURITY_EXPLANATIONS },
};
