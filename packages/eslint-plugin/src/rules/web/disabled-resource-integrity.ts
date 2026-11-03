import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import type { ScriptSettings, IntegrityMessage } from '../../types/security.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    SCRIPT_TYPE,
    ALIASED_PATH,
    VERSIONED_PATH,
    REMOTE_PREFIXES,
    CREATE_SCRIPT_SELECTOR,
} from '../../config/web.ts';

function isVersionedRemoteUrl(value: TSESTree.Node): boolean {
    const url = value.type === AST_NODE_TYPES.Literal && typeof value.value === 'string' ? value.value : '';
    const isRemote = REMOTE_PREFIXES.some((prefix) => url.startsWith(prefix));
    return isRemote && (VERSIONED_PATH.test(url) || ALIASED_PATH.test(url));
}

function getScriptSettings(variable: TSESLint.Scope.Variable): ScriptSettings {
    const members = variable.references.flatMap(({ identifier }) => {
        const member = identifier.parent;
        return member.type === AST_NODE_TYPES.MemberExpression && Object.is(member.object, identifier) ? [member] : [];
    });
    const assignments = members.flatMap((member) =>
        member.parent.type === AST_NODE_TYPES.AssignmentExpression && member.parent.left === member
            ? [{ property: ASTUtils.getPropertyName(member), value: member.parent.right }]
            : [],
    );
    const sources = assignments.filter(({ property }) => property === 'src');
    const crossOrigin = assignments.findLast(({ property }) => property === 'crossOrigin')?.value;
    return {
        sources: sources.length,
        isVersioned: sources.some(({ value }) => isVersionedRemoteUrl(value)),
        hasIntegrity: members.some((member) => ASTUtils.getPropertyName(member) === 'integrity'),
        isAnonymous:
            crossOrigin !== undefined &&
            (crossOrigin.type !== AST_NODE_TYPES.Literal || crossOrigin.value === 'anonymous'),
    };
}

function selectIntegrityMessage(settings: ScriptSettings): IntegrityMessage | undefined {
    if (settings.sources !== 1 || !settings.isVersioned) return undefined;
    if (!settings.hasIntegrity) return settings.isAnonymous ? 'missingIntegrity' : 'missingBoth';
    return settings.isAnonymous ? undefined : 'missingCrossOrigin';
}

export const disabledResourceIntegrity = createRule<[], 'missingBoth' | 'missingIntegrity' | 'missingCrossOrigin'>({
    name: 'disabled-resource-integrity',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            requiresTypeChecking: true,
            description:
                'Finds `<script>` elements that `document.createElement` makes and that load a versioned file from another host without an `integrity` hash and `crossOrigin = "anonymous"`.',
            why: 'Without a subresource integrity check, the page runs whatever script the other host serves, also after an attacker changes it.',
            fix: 'Set `integrity` to the hash of the expected file and `crossOrigin` to `"anonymous"`.',
            example:
                'The code `const script = document.createElement("script"); script.src = "https://cdn.example.com/lib@1.2.3/lib.js";` reports `missingBoth`. Add `script.integrity = "sha384-..."` and `script.crossOrigin = "anonymous"`.',
        },
        schema: [],
        messages: {
            missingBoth: 'Add an integrity hash and crossOrigin = "anonymous" to this script, to check what it loads.',
            missingIntegrity: 'Add an integrity hash to this script, to check what it loads.',
            missingCrossOrigin:
                'Add crossOrigin = "anonymous" to this script, so that the browser checks its integrity.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            [CREATE_SCRIPT_SELECTOR](node: TSESTree.VariableDeclarator) {
                const isScript = types.checker.typeToString(types.get(node.id)) === SCRIPT_TYPE;
                const [variable] = isScript ? source.getDeclaredVariables(node) : [];
                const messageId = variable && selectIntegrityMessage(getScriptSettings(variable));
                if (messageId) context.report({ node, messageId });
            },
        };
    },
});
