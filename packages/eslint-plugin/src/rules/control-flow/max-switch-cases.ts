import { DEFAULT_SWITCH_CASES, SWITCH_CASES_OPTIONS_SCHEMA } from '../../config/control-flow.ts';
import { createRule } from '../../rule.ts';
import type { SwitchCasesOptions } from '../../types/control-flow.ts';

export const maxSwitchCases = createRule<SwitchCasesOptions, 'cases'>({
    name: 'max-switch-cases',
    meta: {
        defaultOptions: [DEFAULT_SWITCH_CASES],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Limits nonempty switch cases, excluding the default clause and empty fallthrough labels.',
            why: 'A large switch mixes many decisions in one place and makes changes harder to review.',
            fix: 'Split the cases by responsibility, or use a lookup when every case performs the same operation.',
            example: 'With a limit of 30, a switch with 31 nonempty case clauses reports one finding.',
        },
        schema: [SWITCH_CASES_OPTIONS_SCHEMA],
        messages: { cases: 'This switch has {{count}} nonempty cases. Reduce it to {{maximum}} or fewer.' },
    },
    create(context, [maximum]) {
        return {
            SwitchStatement(node) {
                const count = node.cases.filter(
                    (clause) => clause.test !== null && clause.consequent.length > 0,
                ).length;
                if (count <= maximum) return;
                context.report({ node, messageId: 'cases', data: { count, maximum } });
            },
        };
    },
});
