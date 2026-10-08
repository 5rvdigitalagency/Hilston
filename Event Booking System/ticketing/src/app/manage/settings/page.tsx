import StaffShell from "../staff-shell";
import ComingSoon from "../coming-soon";

export default function SettingsPage() {
  return (
    <StaffShell active="settings" title="Settings">
      <ComingSoon
        eyebrow="Administration"
        heading="Settings"
        description="Organisation-wide configuration for the ticketing system."
        bullets={["Branding and email templates", "Payment provider configuration", "Notification preferences"]}
      />
    </StaffShell>
  );
}
