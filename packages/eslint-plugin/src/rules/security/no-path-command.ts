import { createRule } from '../../rule.ts';
import { getModuleName } from '../../language/modules.ts';
import { getLiteralValue } from '../../language/expressions.ts';
import { PATH_COMMAND_METHODS, EXPLICIT_COMMAND_PREFIXES } from '../../config/security.ts';

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
                const name = getModuleName(node.callee, context.sourceCode)?.replace(/^node:/u, '');
                if (
                    name === undefined ||
                    !name.startsWith('child_process.') ||
                    !PATH_COMMAND_METHODS.has(name.slice('child_process.'.length))
                )
                    return;
                const argument = node.arguments[0];
                const command = getLiteralValue(argument, context.sourceCode);
                if (
                    argument !== undefined &&
                    typeof command === 'string' &&
                    EXPLICIT_COMMAND_PREFIXES.every((prefix) => !command.startsWith(prefix))
                )
                    context.report({ node: argument, messageId: 'path' });
            },
        };
    },
});
