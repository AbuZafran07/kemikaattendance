import { sendFcm } from "./fcm.ts";
// deno-lint-ignore no-explicit-any
type Client = any;

/** Sends a backup alert to every admin by email (Resend) and push (FCM). Never throws. */
export async function alertAdmins(client: Client, title: string, body: string) {
  try {
    const roles = await client.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (roles.data ?? []).map((r: { user_id: string }) => r.user_id);
    if (!ids.length) return;
    const { data: admins } = await client.from("profiles").select("email, fcm_token").in("id", ids);
    const resend = Deno.env.get("RESEND_API_KEY");
    for (const a of admins ?? []) {
      if (resend && a.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Kemika Attendance <onboarding@resend.dev>", to: [a.email], subject: title, text: body }),
        }).catch(() => undefined);
      }
      if (a.fcm_token) await sendFcm(a.fcm_token, title, body, { type: "backup_alert" }).catch(() => undefined);
    }
  } catch (e) { console.error("Backup alert failed", e instanceof Error ? e.message : "unknown"); }
}
