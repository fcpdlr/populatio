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
      <p>There are four ways to play:</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Daily</strong>: one target and one region for everyone, one
          attempt. A new challenge every day at midnight UTC.
        </li>
        <li>
          <strong>Practice</strong>: the same game with a new region and target
          each round, and as many attempts as you like.
        </li>
        <li>
          <strong>Guess</strong>: we draw the zone, you guess how many people
          live in it. Five rounds, up to 1,000 points each.
        </li>
        <li>
          <strong>More or Less</strong>: two zones, pick the one with more
          people. Keep your streak going as long as you can.
        </li>
      </ul>
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
