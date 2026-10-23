export const PREFIX_TREE = {
    'cards/asset-card.ts': '',
    'cards/asset-list.ts': '',
    'cards/asset-row.ts': '',
    'cards/other.ts': '',
    'mixed/turn.ts': '',
    'mixed/turn-flow/first.ts': '',
    'mixed/turn-flow/second.ts': '',
    'fine/index.ts': '',
    'fine/index-page.ts': '',
    'fine/first.ts': '',
    'fine/second.ts': '',
    'components/button.tsx': '',
    'components/button.module.css': '',
    'components/button.test.tsx': '',
    'components/card.tsx': '',
    'paired/api.ts': '',
    'paired/api.d.ts': '',
    'paired/view.mts': '',
    'paired/view.d.mts': '',
    'paired/social.png': '',
    'paired/social.svg': '',
    'npm/package.json': '{}',
    'npm/package-lock.json': '{}',
    'pnpm/pnpm-lock.yaml': '',
    'pnpm/pnpm-workspace.yaml': '',
} as const;

export const PREFIX_CHECK_OPTIONS = { only: ['structure/shared-prefixes'] };

export const NEST_SUFFIX_FILES = {
    'app/jsx.view.tsx': '',
    'app/jsx.service.tsx': '',
    'app/jsx.controller.tsx': '',
    'app/custom.one.ts': '',
    'app/custom.two.ts': '',
    'app/custom.three.ts': '',
};

export const NESTJS_PREFIX_RESULTS: { scope: string; paths: string[] }[] = [
    { scope: '', paths: ['feature.controller.spec.ts'] },
    { scope: 'app', paths: ['app/custom.one.ts', 'app/jsx.controller.tsx'] },
    { scope: 'app/deep', paths: [] },
    { scope: 'sibling', paths: ['sibling/feature.controller.spec.ts'] },
];
