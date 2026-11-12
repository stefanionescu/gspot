import { expect, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import {
    printError,
    printResult,
    printUnexpectedError,
    printWarning,
    runCancelableCommand,
    setOutputOptions,
} from '#cli/system/terminal.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { fakeTerminals } from '#tests/setup/system/fakes.ts';
import { captureTerminal } from '#tests/setup/system/terminal.ts';

test('an aborted command returns its cancellation status and removes its signal listeners', async () => {
    const listeners = process.listenerCount('SIGINT');
    const result = await runCancelableCommand((signal) => {
        process.emit('SIGINT');
        expect(signal.aborted).toBe(true);
        return Promise.reject(new Error('The command stopped.'));
    }, 'The command was canceled.');
    expect(result).toStrictEqual({
        exitCode: 130,
        text: 'The command was canceled.\n',
        json: { error: 'canceled', message: 'The command was canceled.' },
    });
    expect(process.listenerCount('SIGINT')).toBe(listeners);
});

test('a printed result removes escape sequences and format characters but keeps the gspot colors', () => {
    using output = captureTerminal();
    const { stdout } = output;
    try {
        setOutputOptions({ isJson: false, isVerbose: false });
        const name = 'title\u{1B}]0;renamed\u{7}\u{1B}[2Jcheck‮gnp.exe\u{200B}⁦x⁩';
        printResult({ text: `\u{1B}[31mfailed\u{1B}[39m ${name}\n`, json: {}, exitCode: 1 });
        expect(stdout).toStrictEqual(['\u{1B}[31mfailed\u{1B}[39m titlecheckgnp.exex\n']);
    } finally {
        setOutputOptions({ isJson: false, isVerbose: false });
    }
});

test('a human error removes terminal controls while JSON preserves the message as escaped data', () => {
    const message = 'Before\u{1B}[2Kafter\0\u{7}\u{7F}';
    using output = captureTerminal();
    const { stdout, stderr } = output;
    try {
        setOutputOptions({ isJson: false, isVerbose: false });
        printError({ error: 'filesystem', message });
        expect(stderr).toStrictEqual(['Beforeafter\n']);
        setOutputOptions({ isJson: true, isVerbose: false });
        printError({ error: 'filesystem', message });
        expect(JSON.parse(stdout.join(''))).toStrictEqual({
            version: cliPackage.version,
            exitCode: 2,
            notes: [],
            error: 'filesystem',
            message,
        });
    } finally {
        setOutputOptions({ isJson: false, isVerbose: false });
    }
});

test('warnings use stderr in text mode and join existing JSON notes without writing stderr', () => {
    using output = captureTerminal();
    const { stdout, stderr } = output;
    try {
        setOutputOptions({ isJson: false, isVerbose: false });
        printWarning('Check\u{1B}[2K again.');
        expect(stderr).toStrictEqual(['[warn] Check again.\n']);
        stderr.length = 0;
        setOutputOptions({ isJson: true, isVerbose: false });
        printWarning('Check again.');
        printResult({ text: '', json: { notes: ['Existing note.'] }, exitCode: 0 });
        expect(stderr).toStrictEqual([]);
        expect(JSON.parse(stdout.join(''))).toMatchObject({ notes: ['Check again.', 'Existing note.'] });
    } finally {
        setOutputOptions({ isJson: false, isVerbose: false });
    }
});

test('unexpected command errors use the shared envelope and include their stack only in verbose output', () => {
    using output = captureTerminal();
    const { stdout } = output;
    try {
        const failure = new TypeError('Private implementation detail');
        setOutputOptions({ isJson: true, isVerbose: false });
        printUnexpectedError(failure);
        setOutputOptions({ isJson: true, isVerbose: true });
        printUnexpectedError(failure);
        const brief: unknown = JSON.parse(stdout[0]!);
        const detailed: unknown = JSON.parse(stdout[1]!);
        expect(brief).toMatchObject({
            version: cliPackage.version,
            exitCode: 2,
            error: 'unexpected',
            message: expect.stringContaining(cliPackage.bugs.url) as string,
        });
        expect(stdout[0]).not.toContain(failure.message);
        expect(brief).not.toHaveProperty('stack');
        expect(detailed).toMatchObject({ stack: failure.stack });
    } finally {
        setOutputOptions({ isJson: false, isVerbose: false });
    }
});

test.each([true, false])('warning colors follow stderr when its terminal state is %p', (stderrIsTerminal) => {
    using _environment = overrideEnvironment({ NO_COLOR: undefined, FORCE_COLOR: undefined });
    using _terminals = fakeTerminals([
        [process.stdout, !stderrIsTerminal],
        [process.stderr, stderrIsTerminal],
    ]);
    using output = captureTerminal();
    setOutputOptions({ isJson: false, isVerbose: false });
    printWarning('Read the note.');
    expect(output.stdout).toStrictEqual([]);
    expect(output.stderr).toStrictEqual([
        stderrIsTerminal ? '\u{1B}[33m[warn]\u{1B}[39m Read the note.\n' : '[warn] Read the note.\n',
    ]);
});
