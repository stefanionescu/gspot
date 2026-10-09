import type { ToolSession } from '#cli/types/tools/session.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
/** The selected project, explicitly selected files, and temporary resources owned by the test. */
export type CheckInputOptions = { scope?: string; paths?: string[]; resources?: DisposableStack };

/** A Swift check and its session, with native preparation resources disposed by the owning test. */
export type SwiftBuildInput = { input: CheckInput; session: ToolSession; resources: AsyncDisposableStack };
