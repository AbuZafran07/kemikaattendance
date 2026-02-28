import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { employeeName, summary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Kamu adalah HR analyst profesional. Berdasarkan data kehadiran karyawan berikut, berikan insight singkat dan saran konstruktif dalam Bahasa Indonesia (maksimal 3-4 kalimat). Fokus pada pola kehadiran, keterlambatan, dan area perbaikan. Jangan gunakan bullet point, cukup paragraf singkat.

Nama Karyawan: ${employeeName}
Data Ringkasan:
- Total Hari Hadir Tepat Waktu: ${summary.hadir}
- Total Hari Terlambat: ${summary.terlambat}
- Total Hari Pulang Cepat: ${summary.pulangCepat}
- Total Hari Cuti: ${summary.cuti}
- Total Hari Dinas: ${summary.dinas}
- Total Jam Kerja: ${summary.totalJamKerja}
- Periode: ${summary.periode}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Kamu adalah HR analyst profesional Indonesia yang memberikan insight kehadiran karyawan secara ringkas dan konstruktif." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
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
    const insight = data.choices?.[0]?.message?.content || "Tidak dapat menghasilkan insight.";

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Attendance insight error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
