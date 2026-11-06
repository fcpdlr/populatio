import type { Metadata } from "next";
import { Game } from "@/components/game/Game";

export const metadata: Metadata = {
  title: "populat.io — rodea la población del mundo",
  description:
    "Te damos una cifra de habitantes. Rodea una zona en cualquier lugar del planeta y acércate todo lo posible.",
};

export default function WorldPage() {
  return <Game region="world" />;
}
