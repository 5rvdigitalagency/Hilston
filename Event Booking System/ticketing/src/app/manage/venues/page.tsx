import StaffShell from "../staff-shell";
import ComingSoon from "../coming-soon";

export default function VenuesPage() {
  return (
    <StaffShell active="venues" title="Venues">
      <ComingSoon
        eyebrow="Catalogue"
        heading="Venues"
        description="Manage the physical spaces events are held in, separately from event listings themselves."
        bullets={["Reusable venue profiles (name, address, capacity)", "Attach a venue to multiple events", "Track room/space availability"]}
      />
    </StaffShell>
  );
}
