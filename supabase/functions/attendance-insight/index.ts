import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("attendance-insight: request received");

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("attendance-insight: no auth header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accessToken = authHeader.replace("Bearer ", "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      console.error("attendance-insight: auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("attendance-insight: authenticated user:", user.id);

    const userId = user.id;

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!roleData;

    const body = await req.json();
    const { employeeName, summary, targetUserId } = body;
    console.log("attendance-insight: body received for", employeeName);

    // Authorization: only admins can view other employees' insights
    if (targetUserId && targetUserId !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Input validation
    if (typeof employeeName !== "string" || employeeName.trim().length === 0 || employeeName.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid employeeName" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!summary || typeof summary !== "object") {
      return new Response(JSON.stringify({ error: "Invalid summary" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const numericFields = ["hadir", "terlambat", "pulangCepat", "cuti", "cutiTahunan", "sakit", "izin", "lupaAbsen", "dinas"];
    for (const field of numericFields) {
      const val = summary[field];
      if (val !== undefined && (typeof val !== "number" || val < 0 || val > 366)) {
        return new Response(JSON.stringify({ error: `Invalid summary.${field}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (typeof summary.totalJamKerja !== "string" && typeof summary.totalJamKerja !== "number") {
      return new Response(JSON.stringify({ error: "Invalid summary.totalJamKerja" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof summary.periode !== "string" || summary.periode.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid summary.periode" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize inputs
    const safeName = employeeName.replace(/<[^>]*>/g, "").trim();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("attendance-insight: LOVABLE_API_KEY not set");
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Kamu adalah HR analyst profesional. Berdasarkan data kehadiran karyawan berikut, lakukan 2 hal:

1. Berikan saran konstruktif yang ditujukan LANGSUNG KEPADA karyawan tersebut dalam Bahasa Indonesia (maksimal 3 kalimat pendek saja, total tidak lebih dari 150 kata). Gunakan kata "Anda" untuk menyapa karyawan. Pastikan setiap kalimat SELESAI dengan sempurna dan berakhir dengan tanda titik. Fokus pada pola kehadiran, keterlambatan, dan area perbaikan. Jangan gunakan bullet point, cukup paragraf singkat.

2. Tentukan apakah kehadiran karyawan ini BAGUS atau tidak. Kehadiran dianggap BAGUS HANYA jika: TIDAK ADA sama sekali keterlambatan (terlambat = 0), TIDAK ADA sama sekali pulang cepat (pulang cepat = 0), TIDAK ADA sama sekali absen/tidak hadir, TIDAK ADA sama sekali cuti dalam periode tersebut (cuti = 0). Artinya karyawan hadir FULL setiap hari kerja tanpa ada catatan negatif apapun. Jika ada SATU SAJA keterlambatan, pulang cepat, absen, atau cuti, maka isGood = false. 

PENTING: Respond dalam format JSON SAJA, tanpa markdown code block, tanpa backtick. Format:
{"insight":"isi saran disini","isGood":true}

Jika kehadiran bagus, isGood = true. Jika tidak, isGood = false.

Nama Karyawan: ${safeName}
Data Ringkasan:
- Total Hari Hadir Tepat Waktu: ${summary.hadir}
- Total Hari Terlambat: ${summary.terlambat}
- Total Hari Pulang Cepat: ${summary.pulangCepat}
- Total Hari Cuti: ${summary.cuti}
- Total Hari Dinas: ${summary.dinas}
- Total Jam Kerja: ${summary.totalJamKerja}
- Periode: ${summary.periode}`;

    console.log("attendance-insight: calling AI gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Kamu adalah HR analyst profesional Indonesia yang memberikan saran kehadiran langsung kepada karyawan secara ringkas dan konstruktif. Gunakan kata 'Anda' untuk menyapa karyawan. SELALU respond dalam format JSON murni tanpa markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    console.log("attendance-insight: AI gateway response status:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    console.log("attendance-insight: raw AI response:", rawContent.substring(0, 200));
    
    let insight = "Tidak dapat menghasilkan insight.";
    let isGood = false;
    
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      insight = parsed.insight || insight;
      isGood = parsed.isGood === true;
    } catch {
      insight = rawContent || insight;
      isGood = false;
    }

    console.log("attendance-insight: success, insight length:", insight.length);

    return new Response(JSON.stringify({ insight, isGood }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Attendance insight error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
