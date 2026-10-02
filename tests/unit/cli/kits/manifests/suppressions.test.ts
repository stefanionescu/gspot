// Each tool's suppression definition finds its own comment and reads a reason only where the comment gives one.
import { test, expect } from 'bun:test';
import { kitManifests } from '#cli/kits/manifests.ts';

test.each([
    ['sql', 'sqlfluff', '-- noqa: LT01', '-- noqa: LT01 -- The query keeps the vendor spacing.'],
    ['css', 'stylelint', '/* stylelint-disable */', '/* stylelint-disable -- The vendor sheet keeps its names. */'],
    [
        'html',
        'html-validate',
        '<!-- html-validate-disable -->',
        '<!-- [html-validate-disable-next void-style: The embed owns its markup.] -->',
    ],
    [
        'markdown',
        'markdownlint-cli2',
        '<!-- markdownlint-disable -->',
        '<!-- markdownlint-disable -- The table is generated. -->',
    ],
])('the %s kit reads %s suppressions and their reasons', (kit, tool, bare, explained) => {
    const definition = kitManifests()
        .get(kit)!
        .tools.find(({ name }) => name === tool)!.suppression!;
    const marker = new RegExp(definition.marker, 'u');
    const reason = new RegExp(definition.reason, 'u');
    expect(marker.test(bare)).toBe(true);
    expect(marker.test(explained)).toBe(true);
    expect(reason.exec(bare)?.groups?.['reason']).toBeUndefined();
    expect(reason.exec(explained)?.groups?.['reason']).toBeDefined();
});
