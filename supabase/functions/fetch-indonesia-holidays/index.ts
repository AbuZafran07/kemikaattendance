import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { year } = await req.json();
    const targetYear = year || new Date().getFullYear();

    // Use the public API from date.nager.at for Indonesian holidays
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${targetYear}/ID`
    );

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();

    // Map to our Holiday format
    const holidays = data.map((h: any) => ({
      id: crypto.randomUUID(),
      name: h.localName || h.name,
      date: h.date,
    }));

    return new Response(JSON.stringify({ success: true, holidays }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch holidays",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
