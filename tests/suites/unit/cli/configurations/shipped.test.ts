import { test, expect } from 'bun:test';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };

test('each accepted suppression example matches its marker and gives a reason', () => {
    const forms = readConfigurations()
        .values()
        .flatMap((configuration) =>
            configuration.tools.flatMap((tool) =>
                tool.suppression === undefined || tool.suppression.forbidden === true
                    ? []
                    : { name: tool.name, ...tool.suppression },
            ),
        )
        .toArray();
    for (const form of forms) {
        const example = form.example ?? '';
        const markers = [form.marker, form.inline_marker ?? form.marker].map((pattern) => new RegExp(pattern, 'u'));
        expect(
            markers.some((marker) => marker.test(example)),
            form.name,
        ).toBe(true);
        expect(new RegExp(form.reason, 'u').exec(example)?.groups?.['reason'], form.name).toMatch(/\S/u);
    }
});

test('the javascript manifest pins the workspace version of @gspothq/eslint-plugin', () => {
    const javascript = readConfigurations().get('javascript');
    expect(javascript?.tools.find((tool) => tool.installers['npm']?.name === '@gspothq/eslint-plugin')?.version).toBe(
        pluginPackage.version,
    );
});
