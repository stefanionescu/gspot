import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';

test('parsing keeps only what was written, and the settings get the defaults', () => {
    const settings = parseSettings('[hooks]\n[rules]\nenabled = false\n', undefined, createReadCache(process.cwd()));
    expect(settings.written).toStrictEqual({ hooks: {}, rules: { enabled: false } });
    expect(settings.level).toBe('recommended');
    expect(settings.hooks).toStrictEqual({ enabled: false });
    expect(settings.rules).toStrictEqual({ enabled: false, exclude: [], instruction_files: [] });
});

test('limits are split into root and language tables', () => {
    const settings = parseSettings(
        'configurations = ["bash"]\n[limits]\nfile_lines = 300\nfunction_lines = { value = 80, reason = "Route tables are one ordered list each." }\npython.file_lines = { value = 400, reason = "Python modules retain their project specific size allowance." }\n',
        undefined,
        createReadCache(process.cwd()),
    );
    expect(settings.limits['file_lines']).toBe(300);
    expect(settings.limits['function_lines']).toBe(80);
    expect(settings.limits['python']?.['file_lines']).toBe(400);
});

test('naming settings are split by language and category', () => {
    const settings = parseSettings(
        'configurations = ["naming"]\n[naming]\nbanned_words = ["dispatcher"]\npython.max_words = 4\npython.parameters.max_words = 3\n',
        undefined,
        createReadCache(process.cwd()),
    );
    expect(settings.naming.banned_words).toStrictEqual(['dispatcher']);
    expect(settings.naming['python']?.max_words).toBe(4);
    expect(settings.naming['python']?.['parameters']?.max_words).toBe(3);
});
