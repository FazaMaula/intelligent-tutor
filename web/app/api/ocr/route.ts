export async function POST(request: Request): Promise<Response> {
  const ocrUrl = process.env.OCR_SERVICE_URL ?? "http://localhost:8000";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Format tidak valid" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ocrUrl}/ocr`, { method: "POST", body: formData });
    if (!res.ok) throw new Error(`OCR service responded ${res.status}`);
    return res;
  } catch (err) {
    console.error("OCR error:", err);
    return Response.json(
      { error: "Layanan OCR tidak tersedia. Jalankan ocr_api.py terlebih dahulu." },
      { status: 502 }
    );
  }
}
