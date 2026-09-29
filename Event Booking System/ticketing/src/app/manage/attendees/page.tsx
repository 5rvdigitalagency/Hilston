import StaffShell from "../staff-shell";
import ComingSoon from "../coming-soon";

export default function AttendeesPage() {
  return (
    <StaffShell active="attendees" title="Attendees">
      <ComingSoon
        eyebrow="Event management"
        heading="Attendees"
        description="A single, cross-event view of every guest, independent of which booking they came through."
        bullets={["Search guests across all events", "See a guest's full attendance history", "Spot and merge duplicate guest records"]}
      />
    </StaffShell>
  );
}
