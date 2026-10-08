import { redirect } from "next/navigation";

/** Cancellation/refund terms are covered inside the main site's terms page \u2014 no separate refunds page exists to link to instead. */
export default function RefundsRedirect() {
  redirect("https://hilstonpark.com/terms");
}
