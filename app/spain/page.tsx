import type { Metadata } from "next";
import { Game } from "@/components/game/Game";

export const metadata: Metadata = {
  title: "populat.io — Spain",
  description:
    "We give you a population number. Draw a zone on the map of Spain and get as close as you can.",
};

export default function SpainPage() {
  return <Game region="es" />;
}
