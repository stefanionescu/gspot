import { test, spyOn, expect } from 'bun:test';
import cliPackage from '#cli-package' with { type: 'json' };
import { getColors, printError, printResult, setOutputOptions, runCancelableCommand } from '#cli/system/terminal.ts';

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
    const stdout: string[] = [];
    using _stdout = spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
    });
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
    const stdout: string[] = [];
    const stderr: string[] = [];
    using _stdout = spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        stdout.push(String(chunk));
        return true;
    });
    using _stderr = spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        stderr.push(String(chunk));
        return true;
    });
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
