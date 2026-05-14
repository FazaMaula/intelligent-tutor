import { startSession } from "@/lib/db";

export async function POST(request: Request): Promise<Response> {
  try {
    const { provider, client_type, nama_lengkap, nomor_induk } = await request.json();
    const session_id = await startSession(
      provider ?? "web",
      client_type ?? "web",
      nama_lengkap ?? null,
      nomor_induk ?? null
    );
    return Response.json({ session_id });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
