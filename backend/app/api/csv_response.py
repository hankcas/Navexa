from fastapi import Response

from app.services.export_service import CsvFile

# Shown in Swagger, so the docs say these endpoints return a file and not JSON.
CSV_RESPONSES = {200: {"content": {"text/csv": {}}, "description": "Archivo CSV para Excel"}}


def csv_response(file: CsvFile) -> Response:
    """The CSV as a download. `no-store`: a copy of the fleet must not stay in a shared cache."""
    return Response(
        content=file.content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{file.filename}"',
            "Cache-Control": "no-store",
            "X-Export-Rows": str(file.rows),
        },
    )
