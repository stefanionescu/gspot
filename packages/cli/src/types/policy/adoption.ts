// The types of policy/adoption in this package.
import type { z } from 'zod';
import type { FileSnapshot } from '#cli/types/platform.ts';
import type { RUFF_SOURCE } from '#cli/policy/adoption/ruff.ts';
import type { Policy, RawPolicy } from '#cli/types/policy/policy.ts';
import type { ExistingTool, ExistingTooling, TomlTable } from '#cli/types/repository/repository.ts';

export type CarrySource = { text: string; parsed: TomlTable; original: FileSnapshot };
export type RuffLint = Extract<z.infer<typeof RUFF_SOURCE>, { lint: unknown }>['lint'];
export type PerFile = Record<string, string[]>;
export type Inheritance = {
    root: string;
    lists: CarriedConfiguration;
    base: string;
    visiting: Set<string>;
    inherited: Set<string>;
};
export type CarriedIgnore = { check: string; rule?: string; reason: string; paths?: string[] };
export type CarriedFormatter = {
    format: Policy['format'];
    extra?: TomlTable;
    ignorePatterns?: string[];
    nativeDefaults?: boolean;
    editorconfig?: NonNullable<NonNullable<RawPolicy['tools']>['editorconfig']>['adopted'];
};
export type CarriedLists = Map<string, { settings: TomlTable; ignores: CarriedIgnore[] }>;
export type CarriedConfiguration = {
    tools: CarriedLists;
    scopes: Map<string, { configurations: string[]; tools: Record<string, TomlTable> }>;
    formatter?: CarriedFormatter;
    observed: Map<string, FileSnapshot>;
    removed: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
};
export type CarryPush = (rule: string, paths?: string[]) => void;
export type Carrier = (
    source: CarrySource,
    path: string,
    lists: CarriedConfiguration,
    root: string,
    check?: string,
) => void | Promise<void>;
export type Owned = ExistingTooling['configs'][number];

export type CarryRequest = {
    tool: string;
    path: string;
    lists: CarriedConfiguration;
    root: string;
    reader: ExistingTool['carries'];
    check?: string | undefined;
};
