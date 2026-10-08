import { redirect } from "next/navigation";

/** Cookie use is covered inside the main site's privacy policy \u2014 no separate cookies page exists to link to instead. */
export default function CookiesRedirect() {
  redirect("https://hilstonpark.com/privacy");
}
