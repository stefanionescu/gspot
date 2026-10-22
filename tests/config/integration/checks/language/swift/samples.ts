import { CLEAN_SWIFT } from '#tests/config/checks/language/swift/sandbox.ts';

/** A Swift sandbox that holds one function every check accepts. */
export const SWIFT_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
} as const;
