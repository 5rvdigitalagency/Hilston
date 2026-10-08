import { redirect } from "next/navigation";

/** No separate privacy policy exists for the ticketing subdomain \u2014 the real, maintained policy lives on the main site. */
export default function PrivacyRedirect() {
  redirect("https://hilstonpark.com/privacy");
}
