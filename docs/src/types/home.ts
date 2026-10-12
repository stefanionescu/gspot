export type FeatureProps = {
    title: string;
    description: string;
    features: readonly { title: string; description: string; href: string; link: string }[];
};
