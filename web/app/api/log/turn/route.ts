import { logTurn } from "@/lib/db";

export async function POST(request: Request): Promise<Response> {
  try {
    const { session_id, turn_number, role, content, hint_level } = await request.json();
    await logTurn(session_id, turn_number, role, content, hint_level ?? null);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
