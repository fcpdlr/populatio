import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "About — populat.io" };

export default function AboutPage() {
  return (
    <StaticPage title="About">
      <p>
        <strong>populat.io</strong> is a simple game: we give you a number of
        people, you draw a zone anywhere on the map, and we count how many
        people actually live inside it. The closer you get, the more points
        you score.
      </p>
      <p>
        There are no levels, hints or timers. Just your feel for geography and
        population against real data.
      </p>
      <p>
        Every day there is one daily challenge, the same for everyone, with a
        single attempt. Practice mode gives you as many targets and attempts
        as you like.
      </p>
      <p>
        The count is done cell by cell on a real ~1 km population grid. Read
        the details in{" "}
        <a href="/how-it-works" className="text-accent underline">
          how it works
        </a>
        .
      </p>
    </StaticPage>
  );
}
