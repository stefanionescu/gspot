import { CLEAN_SWIFT } from '#tests/config/checks/language/swift/sandbox.ts';

export const SWIFT_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
} as const;
