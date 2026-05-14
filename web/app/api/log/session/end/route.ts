import { endSession } from "@/lib/db";

export async function POST(request: Request): Promise<Response> {
  try {
    const { session_id, resolved } = await request.json();
    await endSession(session_id, resolved ?? false);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
