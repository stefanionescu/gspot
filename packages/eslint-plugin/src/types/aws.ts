import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type CdkPropertyCheck = {
    path: readonly string[];
    required: boolean;
    position?: number;
    valid?: readonly unknown[];
    invalid?: readonly unknown[];
    validNames?: readonly string[];
    invalidNames?: readonly string[];
};

export type CdkIssue = { node: TSESTree.Node; kind: 'omitted' | 'invalid' };

export type CdkTarget = { value: TSESTree.Node; report: TSESTree.Node };

export type CdkLiteralTarget = { literal: TSESTree.ObjectExpression; report: TSESTree.Node };

export type CdkPathResult = { targets: CdkTarget[]; issues: CdkIssue[] };

export type CdkResult = { status: 'found' | 'missing' | 'unknown'; node: TSESTree.Node };

type PolicyKeys = {
    effect: string;
    allow: string;
    actions: string;
    resources: string;
    conditions: string;
    principals: string;
    isJson: boolean;
};

export type PolicyStatement = { statement: CdkResult; keys: PolicyKeys };

export type CdkFinding = CdkIssue & { property: string };

export type StorageIssue = { node: TSESTree.Node; messageId: 'omitted' | 'unencrypted' };

export type AdminAccess = { node: TSESTree.Node; messageId: 'openRange' | 'anyAddress' };

export type PublicGrant = TSESLint.ReportDescriptor<'accessLevel' | 'unrestricted'>;
