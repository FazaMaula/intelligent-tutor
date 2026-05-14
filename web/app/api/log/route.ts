export async function GET(): Promise<Response> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase.rpc("compute_metrics");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
