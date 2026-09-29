export function demoSeedAllowed() {
  if (process.env.EVENT_DEPLOYMENT_ROLE === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.EVENT_DEPLOYMENT_ROLE !== "staging") return false;
  return true;
}
