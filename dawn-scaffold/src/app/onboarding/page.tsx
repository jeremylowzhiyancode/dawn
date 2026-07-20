import { redirect } from "next/navigation";

/** Opens the hospital onboarding one-pager in the browser. */
export default function OnboardingOnePagerPage() {
  redirect("/hospital-onboarding-one-pager.html");
}
