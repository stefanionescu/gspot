import { test, expect } from 'bun:test';
import cliPackage from '#cli-package' with { type: 'json' };
import { captureTerminal } from '#tests/setup/system/terminal.ts';

import {
    getColors,
    printError,
    printResult,
    printWarning,
    setOutputOptions,
    runCancelableCommand,
} from '#cli/system/terminal.ts';

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
        setOutputOptions({ isJson: false, colored: true });
        const name = 'title\u001B]0;renamed\u0007\u001B[2Jcheck‮gnp.exe​⁦x⁩';
        printResult({ text: `${getColors().red('failed')} ${name}\n`, json: {}, exitCode: 1 });
        expect(stdout).toStrictEqual(['\u001B[31mfailed\u001B[39m titlecheckgnp.exex\n']);
    } finally {
        setOutputOptions({ isJson: false, colored: false });
    }
});

test('a human error removes terminal controls while JSON preserves the message as escaped data', () => {
    const message = 'Before\u001B[2Kafter\u0000\u0007\u007F';
    using output = captureTerminal();
    const { stdout, stderr } = output;
    try {
        setOutputOptions({ isJson: false, colored: false });
        printError({ error: 'filesystem', message });
        expect(stderr).toStrictEqual(['Beforeafter\n']);
        setOutputOptions({ isJson: true, colored: false });
        printError({ error: 'filesystem', message });
        expect(stdout.join('')).not.toContain('\u001B');
        expect(JSON.parse(stdout.join(''))).toStrictEqual({
            version: cliPackage.version,
            exitCode: 2,
            notes: [],
            error: 'filesystem',
            message,
        });
    } finally {
        setOutputOptions({ isJson: false, colored: false });
    }
});

test('warnings use stderr in text mode and join existing JSON notes without writing stderr', () => {
    using output = captureTerminal();
    const { stdout, stderr } = output;
    try {
        setOutputOptions({ isJson: false, colored: false });
        printWarning('Check\u001B[2K again.');
        expect(stderr).toStrictEqual(['[warn] Check again.\n']);
        stderr.length = 0;
        setOutputOptions({ isJson: true, colored: false });
        printWarning('Check again.');
        printResult({ text: '', json: { notes: ['Existing note.'] }, exitCode: 0 });
        expect(stderr).toStrictEqual([]);
        expect(JSON.parse(stdout.join(''))).toMatchObject({ notes: ['Check again.', 'Existing note.'] });
    } finally {
        setOutputOptions({ isJson: false, colored: false });
    }
});
