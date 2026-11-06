import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "Privacy — populat.io" };

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy">
      <p>
        This game needs no account and collects no personal information. We
        don&apos;t ask for your email, name, location or any device
        permissions.
      </p>
      <p>
        Your best scores, attempts and streaks are stored only in your
        browser&apos;s local storage. They never leave your device, and you can
        delete them by clearing this site&apos;s data.
      </p>
      <p>
        We don&apos;t use non-essential cookies. If an analytics tool is added
        in the future, it will be privacy-friendly, limited to aggregated game
        events, and this page will be updated to say so.
      </p>
      <p>
        We don&apos;t show ads. The result panel includes an optional support
        link (&ldquo;Buy me a coffee&rdquo;) that opens an external site in a
        new tab; showing it shares no data with that platform.
      </p>
    </StaticPage>
  );
}
