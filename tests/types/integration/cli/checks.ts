// The types of integration/cli/checks in this package.
import type { Mock } from 'bun:test';
import type { TestdirResult } from 'testdirs';
import type { CheckSpec } from '#cli/types/kits.ts';
import type { inspectTool } from '#cli/tools/inspect.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';

/** What the Cloudflare types test plants: the generated declaration, its developer edit, and the mocked inspection. */
export type CloudflarePlanted = {
    directory: TestdirResult;
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
    directory: TestdirResult;
    path: (file: string) => string;
    manual: string;
    mode: number;
    initial: string;
    spec: CheckSpec;
    input: EngineInput;
};
/** What the OpenAPI freshness test plants: the document and its developer edit. */
export type OpenapiPlanted = {
    directory: TestdirResult;
    document: string;
    edited: string;
    mode: number;
    spec: CheckSpec;
    input: EngineInput;
};

/** A native site-tool report, its correction, and the finding the adapter must preserve. */
export type SiteReportCase = {
    name: string;
    analyze: (input: EngineInput) => Promise<Finding[]>;
    defect: (output: string) => Record<string, unknown> | Record<string, unknown>[];
    corrected: Record<string, unknown> | Record<string, unknown>[];
    status: number;
    file: string;
    rule: string;
};

/** Commands and disposable copies read at the Next.js process boundary. */
export type NextjsRead = {
    directories: string[];
    inspections: string[][];
    routesSeen: string[];
    [Symbol.dispose]: () => void;
};

/** Native Jest inputs for valid, malformed, or absent report artifacts. */
export type JestReportInputs = {
    tests: 'valid' | 'malformed' | 'missing';
    testCount: number;
    runtimeFailures: number;
    status: string;
    coverage: number | string | undefined;
};
