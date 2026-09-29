import { redirect } from "next/navigation";

/** Anonymous visitors land here expecting the public site, not a staff login wall — staff hitting "/" are already redirected to /manage/cms by middleware before this ever renders. */
export default function Home() {
  redirect("/events");
}
