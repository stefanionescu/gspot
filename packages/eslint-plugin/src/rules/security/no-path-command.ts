import { EXPLICIT_COMMAND, PATH_COMMAND_METHODS } from '../../config/security.ts';
import { getLiteralValue } from '../../language/expressions.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { createRule } from '../../rule.ts';

export const noPathCommand = createRule<[], 'path'>({
    name: 'no-path-command',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'all',
            description: 'Reports child_process commands whose literal executable depends on PATH lookup.',
            why: 'A writable directory in PATH can replace the intended program with an attacker-controlled executable.',
            fix: 'Use an explicit executable path and ensure its directory cannot be changed by untrusted users.',
            example: '`spawn("/usr/bin/git", ["status"])` names the executable explicitly.',
        },
        schema: [],
        messages: {
            path: 'Use an explicit executable path, or ensure every PATH directory is trusted and not writable.',
        },
    },
    create(context) {
        return {
            CallExpression: (node) => {
                const name = getQualifiedName(node.callee, context.sourceCode);
                if (name === undefined || !PATH_COMMAND_METHODS.has(name)) return;
                const argument = node.arguments[0];
                const command = getLiteralValue(argument, context.sourceCode);
                if (argument !== undefined && typeof command === 'string' && !EXPLICIT_COMMAND.test(command))
                    context.report({ node: argument, messageId: 'path' });
            },
        };
    },
});
