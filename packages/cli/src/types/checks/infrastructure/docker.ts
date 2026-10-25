import type { TrackedFile } from '#cli/types/repository/files.ts';

export type ComposeDeclaration = { name: string; path: string; service: ComposeService };

export type ComposeFiles = { last: TrackedFile; before: TrackedFile[] };

export type ComposeDocuments = { declarations: ComposeDeclaration[]; contexts: Map<string, string[]> };

export type ComposeService = {
    image?: string | undefined;
    build?:
        | { context: string; dockerfile: undefined }
        | { context?: string | undefined; dockerfile?: string | undefined }
        | undefined;
};

export type ComposeConfiguration = { services?: Record<string, ComposeService> | undefined };

export type TrivyImageOutput = {
    Results?:
        | {
              Vulnerabilities?: { VulnerabilityID: string; PkgName: string }[] | undefined;
              Secrets?: { RuleID: string; Title: string }[] | undefined;
          }[]
        | undefined;
};

export type ImageFinding = { rule: string; message: string };
