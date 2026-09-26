// The types of checks/security in this package.

export type BaselineReason = { fingerprint: string; reason: string };
export type GitleaksFinding = { Fingerprint: string; File: string; RuleID: string; Commit?: string };
export type AcceptedResult = { rule: string; paths: string[]; reason: string };
export type EnvRead = { key: string; line: number };
