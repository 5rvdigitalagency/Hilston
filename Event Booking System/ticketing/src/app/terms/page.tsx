import { redirect } from "next/navigation";

/** No separate terms page exists for the ticketing subdomain \u2014 the real, maintained terms (including cancellations/payments) live on the main site. */
export default function TermsRedirect() {
  redirect("https://hilstonpark.com/terms");
}
