from __future__ import annotations
from fastapi import FastAPI, UploadFile, HTTPException
from pix2tex.cli import LatexOCR
from PIL import Image
import io

app = FastAPI()
_model: LatexOCR | None = None


def get_model() -> LatexOCR:
    global _model
    if _model is None:
        _model = LatexOCR()
    return _model


@app.post("/ocr")
async def ocr(file: UploadFile):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Gambar terlalu besar (maks 10 MB)")
    img = Image.open(io.BytesIO(data)).convert("RGB")
    latex = get_model()(img)
    return {"latex": latex}
