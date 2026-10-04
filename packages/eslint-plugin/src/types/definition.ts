export type RuleDocs = {
    title: string;
    level: 'recommended' | 'all' | 'none';
    description: string;
    why: string;
    fix: string;
    example: string;
};
