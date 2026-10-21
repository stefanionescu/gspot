export type CloneLocation = { name: string; start: number; end: number };

export type CloneReport = {
    duplicates: {
        lines: number;
        firstFile: CloneLocation;
        secondFile: CloneLocation;
    }[];
};
