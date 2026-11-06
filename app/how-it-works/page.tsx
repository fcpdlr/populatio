import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "How it works — populat.io" };

export default function HowItWorksPage() {
  return (
    <StaticPage title="How it works">
      <p>
        The count works on a <strong>population grid</strong>: the planet is
        split into cells of about 1 km × 1 km, and each cell holds an estimate
        of how many people live there. Countries, regions and cities play no
        part in the calculation.
      </p>
      <h2 className="font-display text-xl font-bold">Counting your zone</h2>
      <p>
        When you check a zone, we add up the population of every cell whose
        centre falls inside the shape you drew.
      </p>
      <p className="rounded-xl bg-accent-soft p-4 font-mono text-sm">
        population = Σ people in each cell whose centre is inside your zone
      </p>
      <p>
        The grid uses an <strong>equal-area projection</strong> (Mollweide), so
        a cell in Norway covers the same ground as a cell in Nigeria. For small
        and medium zones we count at 1 km and only download the parts of the
        grid your zone touches. For large zones we count on a 10 km version of
        the same grid, which is instant and changes the result by around 1%.
      </p>
      <p>
        The work runs in a background thread, so the page never freezes while
        it counts.
      </p>
      <h2 className="font-display text-xl font-bold">Scoring</h2>
      <p>
        You score up to 1,000 points, depending on how far your zone is from
        the target, as a percentage: 5% off is worth about 850 points, 10%
        about 720, 20% about 510 and 50% about 190. Getting close always pays,
        even if you don&apos;t nail it.
      </p>
      <h2 className="font-display text-xl font-bold">Limitations</h2>
      <p>
        Cells on the edge of your zone are not split: a cell counts in full if
        its centre is inside, and not at all if it is outside. The error this
        adds is bounded by the cell size and is tiny for zones of playable
        size.
      </p>
      <p>
        The figures are modelled estimates, not a head count. Census totals
        are spread across each country using satellite-detected buildings, so
        very local numbers can differ from official statistics.
      </p>
      <h2 className="font-display text-xl font-bold">Data sources</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Population: <strong>GHS-POP R2023A</strong>, epoch 2025, 1 km,
          Mollweide. Schiavina M., Freire S., Carioli A., MacManus K. (2023),
          European Commission, Joint Research Centre (JRC).{" "}
          <a
            href="https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php"
            className="text-accent underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Global Human Settlement Layer
          </a>
          , licensed under CC BY 4.0.
        </li>
        <li>
          Coastlines and borders: <strong>Natural Earth</strong> 1:50m (public
          domain), via world-atlas.
        </li>
        <li>
          Spain mode: population grid built from the Spanish National
          Statistics Institute (INE) at ~1 km.
        </li>
      </ul>
    </StaticPage>
  );
}
