import StaffShell from "../staff-shell";
import ComingSoon from "../coming-soon";

export default function CouponsPage() {
  return (
    <StaffShell active="coupons" title="Coupons">
      <ComingSoon
        eyebrow="Sales"
        heading="Coupons"
        description="Discount codes guests can apply at checkout on the public booking flow."
        bullets={["Percentage or fixed-amount discounts", "Usage limits and expiry dates", "Per-event or sitewide codes"]}
      />
    </StaffShell>
  );
}
