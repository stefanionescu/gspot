// The types of plugin in this package.
import type { TSESLint } from '@typescript-eslint/utils';

export type RuleSpec<Options extends readonly unknown[], MessageIds extends string> = Readonly<{
    name: string;
    meta: Omit<TSESLint.RuleMetaData<MessageIds, RuleDocs, Options>, 'docs'> & { docs: RuleDocs };
    defaultOptions: Readonly<Options>;
    create: (
        context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
        defaultedOptions: Readonly<Options>,
    ) => TSESLint.RuleListener;
}>;
export type RuleDocs = {
    title: string;
    level?: 'recommended' | 'all';
    summary: string;
    why: string;
    fix: string;
    example: string;
};
export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };
export type RuleContextOf = Readonly<TSESLint.RuleContext<string, unknown[]>>;
