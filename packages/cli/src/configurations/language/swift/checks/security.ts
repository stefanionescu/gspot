import type { Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/tools.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';

import {
    LOG_METHODS,
    SECRET_WORD,
    SECRET_VALUE,
    LOG_FUNCTIONS,
    PRIVACY_LABEL,
    PUBLIC_PRIVACY,
    SECRET_PLIST_KEY,
    UNSAFE_SWIFT_NAMES,
    SWIFT_SECRET_FINDINGS,
    PLIST_READ_EXPRESSION,
    USER_DEFAULTS_RECEIVER,
    USER_DEFAULTS_DECLARATION,
} from '#cli/config/configurations/swift.ts';

function listCallValues(call: Node): Node[] {
    const argumentsNode = call.namedChildren
        .find((node) => node.type === 'call_suffix')
        ?.namedChildren.find((node) => node.type === 'value_arguments');
    return (argumentsNode?.namedChildren ?? []).flatMap((node) => node.childForFieldName('value') ?? []);
}

function readMethod(call: Node): { receiver: string; name: string } | undefined {
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
    if (!LOG_FUNCTIONS.has(callee) && !LOG_METHODS.has(readMethod(call)?.name ?? '')) return false;
    return listCallValues(call).some((value) =>
        value.type.endsWith('string_literal')
            ? value.namedChildren.some((child) => child.type === 'interpolated_expression' && isExposed(child))
            : SECRET_VALUE.test(value.text),
    );
}

function isSecretDefault(call: Node, defaults: Set<string>): boolean {
    const method = readMethod(call);
    if (method?.name !== 'set' || !(USER_DEFAULTS_RECEIVER.test(method.receiver) || defaults.has(method.receiver)))
        return false;
    return listCallValues(call).some(
        (value) => value.parent?.childForFieldName('name')?.text === 'forKey' && SECRET_WORD.test(value.text),
    );
}

function listSecretNodes(syntaxRoot: Node, source: string): (readonly [Node, { rule: string; message: string }])[] {
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

/**
Reports always-accessible Keychain items, weak hashes, and each secret in UserDefaults, a plist read, or a log.

@param session the repository and its tools.
@param planned the scope Swift files.
*/
export async function checkSwiftSecurity(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: CheckFinding[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        const names = source.rootNode
            .descendantsOfType(['simple_identifier', 'navigation_expression'])
            .flatMap((node) => {
                const unsafe = UNSAFE_SWIFT_NAMES.get(node.text);
                return unsafe === undefined ? [] : [[node, unsafe] as const];
            });
        for (const [node, finding] of [...names, ...listSecretNodes(source.rootNode, source.text)])
            findings.push({
                file: source.path,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
                ...finding,
            });
    });
    return findings;
}
