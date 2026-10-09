import type { TSESTree } from '@typescript-eslint/utils';

export type TrivialFilesOptions = [{ maxStatements: number; allowIndex: boolean }];

export type ContentCheck = (node: TSESTree.Node | null) => boolean;
