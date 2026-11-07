import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import (
    AuthenticationError,
    BusinessRuleError,
    PermissionDeniedError,
)
from app.integrations.wialon.exceptions import WialonError, WialonUnavailableError

logger = logging.getLogger(__name__)

PROBLEM_JSON = "application/problem+json"


def problem(
    request: Request, status: int, title: str, detail: str, **extra
) -> JSONResponse:
    body = {
        "type": "about:blank",
        "title": title,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        **extra,
    }
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AuthenticationError)
    async def authentication_error(request: Request, exc: AuthenticationError):
        logger.info("Authentication failed on %s: %s", request.url.path, exc)
        return problem(
            request,
            401,
            "No autenticado",
            "Correo o contraseña incorrectos, o la sesión expiró. Si fallaste varias veces, espera 15 minutos.",
        )

    @app.exception_handler(PermissionDeniedError)
    async def permission_denied(request: Request, exc: PermissionDeniedError):
        logger.warning("Access denied on %s: %s", request.url.path, exc)
        return problem(
            request,
            403,
            "Acceso denegado",
            "No tienes permiso para realizar esta acción.",
        )
        @app.exception_handler(BusinessRuleError)
        async def business_rule_error(request: Request, exc: BusinessRuleError):
         return problem(request, 422, "Solicitud no válida", exc.message)

    @app.exception_handler(WialonUnavailableError)
    async def wialon_unavailable(request: Request, exc: WialonUnavailableError):
        logger.warning("Wialon unavailable: %s", exc)
        return problem(
            request,
            503,
            "Servicio externo no disponible",
            "No pudimos comunicarnos con la plataforma de rastreo. Intenta de nuevo en unos segundos.",
        )

    @app.exception_handler(WialonError)
    async def wialon_error(request: Request, exc: WialonError):
        logger.error("Wialon error code=%s: %s", exc.code, exc)
        return problem(
            request,
            502,
            "Error en la plataforma de rastreo",
            "La plataforma de rastreo no pudo procesar la solicitud.",
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        return problem(request, exc.status_code, "Error en la solicitud", str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        errors = [
            {"field": ".".join(str(part) for part in err["loc"][1:]), "message": err["msg"]}
            for err in exc.errors()
        ]
        return problem(
            request,
            422,
            "Datos inválidos",
            "Uno o más parámetros no son válidos.",
            errors=errors,
        )

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s", request.url.path)
        return problem(request, 500, "Error interno", "Ocurrió un error inesperado.")