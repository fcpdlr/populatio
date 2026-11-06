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
        We use Vercel Web Analytics to count visits and a few anonymous game
        events (for example, a game started, a result shared). It uses no
        cookies and stores no personal data or IP addresses.
      </p>
      <p>
        Shared result links contain only the numbers of your result and a
        rough outline of the zone you drew, never anything about you.
      </p>
      <p>We don&apos;t show ads.</p>
    </StaticPage>
  );
}
