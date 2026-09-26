// The types of integration/cli/checks in this package.
import type { Mock } from 'bun:test';
import type { inspectTool } from '#cli/tools/inspect.ts';
import type { CheckSpec } from '#cli/types/configurations.ts';
import type { EngineInput } from '#cli/types/checks/checks.ts';
import type { TestDirectory } from '#tests/types/support/cli.ts';

/** What the Cloudflare types test plants: the generated declaration, its developer edit, and the mocked inspection. */
export type CloudflarePlanted = {
    directory: TestDirectory;
    path: (name: string) => string;
    target: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
    locate: Mock<typeof inspectTool>;
};
/** What the Drizzle migrations test plants: the manual and the initial migration. */
export type DrizzlePlanted = {
    directory: TestDirectory;
    path: (file: string) => string;
    manual: string;
    mode: number;
    initial: string;
    spec: CheckSpec;
    input: EngineInput;
};
/** What the OpenAPI freshness test plants: the document and its developer edit. */
export type OpenapiPlanted = {
    directory: TestDirectory;
    document: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
};
