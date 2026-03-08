import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TABLES = [
  "profiles",
  "attendance",
  "leave_requests",
  "overtime_requests",
  "business_travel_requests",
  "payroll_periods",
  "payroll",
  "payroll_overrides",
  "employee_loans",
  "loan_installments",
];

const MAX_BACKUPS = 4;

Deno.serve(async (req) => {
  // Allow CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all table data
    const backupData: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        console.error(`Error fetching ${table}:`, error.message);
        backupData[table] = [];
      } else {
        backupData[table] = data || [];
      }
    }

    const backup = {
      version: "1.0",
      app: "Kemika Attendance",
      created_at: new Date().toISOString(),
      type: "scheduled",
      tables: TABLES,
      data: backupData,
    };

    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const fileName = `scheduled-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    // Upload backup
    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(fileName, blob, { contentType: "application/json", upsert: false });

    if (uploadError) throw uploadError;

    // Cleanup: keep only the latest MAX_BACKUPS scheduled backups
    const { data: files } = await supabase.storage
      .from("backups")
      .list("", { sortBy: { column: "created_at", order: "desc" } });

    if (files) {
      const scheduledFiles = files.filter((f) => f.name.startsWith("scheduled-backup-"));
      if (scheduledFiles.length > MAX_BACKUPS) {
        const toDelete = scheduledFiles.slice(MAX_BACKUPS).map((f) => f.name);
        await supabase.storage.from("backups").remove(toDelete);
        console.log(`Cleaned up ${toDelete.length} old scheduled backups`);
      }
    }

    console.log(`Scheduled backup completed: ${fileName}`);

    return new Response(JSON.stringify({ success: true, fileName }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Scheduled backup failed:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
