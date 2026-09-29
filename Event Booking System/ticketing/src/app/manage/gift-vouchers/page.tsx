import StaffShell from "../staff-shell";
import ComingSoon from "../coming-soon";

export default function GiftVouchersPage() {
  return (
    <StaffShell active="gift-vouchers" title="Gift vouchers">
      <ComingSoon
        eyebrow="Sales"
        heading="Gift vouchers"
        description="Purchasable vouchers guests can buy for someone else and redeem against a booking."
        bullets={["Fixed-value voucher codes", "Redemption tracking", "Expiry and balance management"]}
      />
    </StaffShell>
  );
}
