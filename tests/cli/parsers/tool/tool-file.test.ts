import { test, expect } from 'bun:test';
import { getIniSection } from '#cli/parsers/tool/contracts.ts';

test('INI selection retains exact section text and treats malformed headings as content', () => {
    const selected =
        '[tool] # selected\r\nkey = value\r\n[other] trailing text\r\n[]\r\n[tool:child]; nested\r\nvalue = 2\r';
    expect(getIniSection(`[unrelated]\r\nvalue = 1\r\n${selected}\n[toolbox]\nvalue = 3\n`, 'tool')).toBe(selected);
    expect(getIniSection('[toolbox]\nvalue = 3\n', 'tool')).toBeUndefined();
    expect(getIniSection('[tool\nvalue = 3\n', 'tool')).toBeUndefined();
});

test('INI selection rejects duplicate selected headings and accepts repeated unrelated sections', () => {
    expect(() => getIniSection('[tool:child]\nx = 1\n[other]\n[tool:child] ; repeated\nx = 2', 'tool')).toThrow(
        'Duplicate configuration section: tool:child',
    );
    expect(getIniSection('[other]\n[other]\n[tool:child]\nx = 1\n', 'tool')).toBe('[tool:child]\nx = 1\n');
});
