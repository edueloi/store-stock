import { Footprints, Lightbulb, Package, Shirt, Smartphone, Wrench } from "lucide-react";

const icons = { package: Package, fashion: Shirt, footwear: Footprints, light: Lightbulb, tools: Wrench, tech: Smartphone };

export function CategoryGlyph({ icon, size = 13 }: { icon?: string | null; size?: number }) {
  const Icon = icons[icon as keyof typeof icons] || Package;
  return <Icon size={size} />;
}
