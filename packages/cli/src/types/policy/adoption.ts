// The types of policy/adoption in this package.
import type { z } from 'zod';
import type { FileObservation } from '#cli/types/platform.ts';
import type { RUFF_SOURCE } from '#cli/policy/adoption/ruff.ts';
import type { Policy, RawPolicy } from '#cli/types/policy/policy.ts';
import type { TomlTable, ExistingTool, ExistingTooling } from '#cli/types/repository/repository.ts';

export type ConfigurationSource = { text: string; parsed: TomlTable; original: FileObservation };
export type RuffLint = Extract<z.infer<typeof RUFF_SOURCE>, { lint: unknown }>['lint'];
export type PerFile = Record<string, string[]>;
export type Inheritance = {
    root: string;
    lists: AdoptionResult;
    base: string;
    visiting: Set<string>;
    inherited: Set<string>;
};
export type AdoptedIgnore = { check: string; rule?: string; reason: string; paths?: string[] };
export type AdoptedFormatting = {
    format: Policy['format'];
    extra?: TomlTable;
    ignorePatterns?: string[];
    nativeDefaults?: boolean;
    editorconfig?: NonNullable<NonNullable<RawPolicy['tools']>['editorconfig']>['adopted'];
};
export type AdoptedScope = { kits: string[]; tools: Record<string, TomlTable> };
export type AdoptionResult = {
    tools: Map<string, { settings: TomlTable; ignores: AdoptedIgnore[] }>;
    scopes: Map<string, AdoptedScope>;
    formatter?: AdoptedFormatting;
    observed: Map<string, FileObservation>;
    removed: { path: string; note: string }[];
    unread: { path: string; note: string }[];
    retained: { path: string; note: string }[];
};
export type CarryPush = (rule: string, paths?: string[]) => void;
export type Carrier = (
    source: ConfigurationSource,
    path: string,
    lists: AdoptionResult,
    root: string,
    check?: string,
) => void | Promise<void>;
export type Owned = ExistingTooling['configs'][number];

export type CarryRequest = {
    tool: string;
    path: string;
    lists: AdoptionResult;
    root: string;
    reader: ExistingTool['carries'];
    check?: string | undefined;
};
