import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_attendance",
  title: "Riwayat absensi saya",
  description: "Read the signed-in employee's most recent attendance records, without photos, coordinates, notes, or payroll data.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(30).describe("Maximum attendance records to return, from 1 to 50.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return { content: [{ type: "text", text: "Authentication required." }], isError: true };
    const db = await supabaseForUser(ctx);
    const { data: profile, error: profileError } = await db.from("profiles").select("status,departemen").eq("id", userId).maybeSingle();
    if (profileError || !profile || profile.status !== "Active") return { content: [{ type: "text", text: "Attendance access requires an active employee account." }], isError: true };
    if (["BOD", "Komisaris"].includes(profile.departemen)) return { content: [{ type: "text", text: "This account is excluded from attendance." }], isError: true };
    const { data, error } = await db.from("attendance").select("id,check_in_time,check_out_time,status,late_minutes,duration_minutes").eq("user_id", userId).order("check_in_time", { ascending: false }).order("id").limit(limit);
    if (error) return { content: [{ type: "text", text: "Unable to read attendance. Please try again." }], isError: true };
    const rows = (data ?? []).map(row => ({ id: String(row.id), check_in_time: String(row.check_in_time), check_out_time: row.check_out_time ? String(row.check_out_time) : null, status: String(row.status), late_minutes: Number(row.late_minutes ?? 0), duration_minutes: row.duration_minutes === null ? null : Number(row.duration_minutes) }));
    return { content: [{ type: "text", text: rows.length ? rows.map(row => `${row.check_in_time}: ${row.status}; late ${row.late_minutes} minutes`).join("\n") : "No attendance records." }], structuredContent: { attendance: rows } };
  },
});