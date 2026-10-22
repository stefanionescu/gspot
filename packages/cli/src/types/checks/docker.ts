import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { TRIVY_SCHEMA_VERSION } from '#cli/config/checks/docker.ts';

/** One service of a Compose file: its name, the file that declares it, and its settings. */
export type ComposeDeclaration = { name: string; path: string; service: ComposeService };

/** The Compose files of one project: the base files in order, and the file that findings point at. */
export type ComposeFiles = { last: TrackedFile; before: TrackedFile[] };

/** The services of every Compose file, and the ignore files that each Dockerfile may use. */
export type ComposeDocuments = { declarations: ComposeDeclaration[]; contexts: Map<string, string[]> };

/** One Compose service: its image and build settings. */
export type ComposeService = {
    image?: string | undefined;
    build?:
        | { context: string; dockerfile: undefined }
        | { context?: string | undefined; dockerfile?: string | undefined }
        | undefined;
};

export type ComposeConfiguration = { services?: Record<string, ComposeService> | undefined };

export type TrivyImageReport = {
    SchemaVersion: typeof TRIVY_SCHEMA_VERSION;
    Results?:
        | {
              Vulnerabilities?: { VulnerabilityID: string; PkgName: string }[] | undefined;
              Secrets?: { RuleID: string; Title: string }[] | undefined;
          }[]
        | undefined;
};

/** One image scan result before a Compose file gives it a source location. */
export type ImageFinding = { rule: string; message: string };
