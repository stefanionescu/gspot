/** SVG byte savings at the effective default or an authored percentage. */
export type SvgSavingCase = {
    name: string;
    level: 'recommended' | 'all';
    percent?: number;
    saved: number;
    finding: boolean;
};
