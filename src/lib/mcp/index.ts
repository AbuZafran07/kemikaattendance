import { auth, defineMcp } from "@lovable.dev/mcp-js";
import myAttendance from "./tools/my-attendance";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";
export default defineMcp({
  name: "hris-kemika",
  title: "HRIS Kemika",
  version: "0.1.0",
  instructions: "Read your own attendance history. Tools act as the authenticated employee and preserve application permissions. No payroll, biometric, or employee-directory data is exposed.",
  auth: auth.oauth.issuer({ issuer: `https://${projectRef}.supabase.co/auth/v1`, acceptedAudiences: "authenticated" }),
  tools: [myAttendance],
});