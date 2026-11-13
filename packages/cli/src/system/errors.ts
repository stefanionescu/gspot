import type { ErrorCode } from '#cli/types/system.ts';

export class GspotError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'GspotError';
        this.code = code;
    }
}

export class CheckStop extends Error {
    readonly status: 'skipped' | 'missing' | 'error';

    readonly skipCause: 'condition' | 'replaced' | undefined;

    constructor(
        status: CheckStop['status'],
        note: string,
        options?: ErrorOptions & { skipCause?: 'condition' | 'replaced' },
    ) {
        super(note, options);
        this.name = 'CheckStop';
        this.status = status;
        this.skipCause = options?.skipCause;
    }
}

export function hasErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}
