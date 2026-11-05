import asyncio
import json
import logging
from typing import Any

import httpx

from app.integrations.wialon.exceptions import (
    WialonError,
    WialonSessionError,
    WialonUnavailableError,
)

logger = logging.getLogger(__name__)

INVALID_SESSION = 1


class WialonClient:
    """Talks to the Wialon Remote API and manages the session (sid)."""

    def __init__(self, base_url: str, token: str, timeout: float = 10.0):
        self._base_url = base_url
        self._token = token
        self._sid: str | None = None
        self._lock = asyncio.Lock()
        self._http = httpx.AsyncClient(timeout=timeout)

    async def call(self, svc: str, params: dict[str, Any] | None = None) -> Any:
        if self._sid is None:
            await self._login()
        try:
            return await self._request(svc, params or {}, self._sid)
        except WialonSessionError:
            logger.info("Wialon session expired, logging in again")
            await self._login(force=True)
            return await self._request(svc, params or {}, self._sid)

    async def _login(self, force: bool = False) -> None:
        async with self._lock:
            if self._sid is not None and not force:
                return
            data = await self._request("token/login", {"token": self._token}, sid=None)
            self._sid = data["eid"]
            logger.info("Wialon login successful")

    async def _request(self, svc: str, params: dict[str, Any], sid: str | None) -> Any:
        payload = {"svc": svc, "params": json.dumps(params)}
        if sid:
            payload["sid"] = sid
        try:
            response = await self._http.post(self._base_url, data=payload)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as exc:
            raise WialonUnavailableError(f"Wialon request failed: {svc}") from exc
        except ValueError as exc:
            raise WialonError(f"Invalid response from Wialon: {svc}") from exc

        if isinstance(data, dict) and data.get("error", 0) != 0:
            code = data["error"]
            if code == INVALID_SESSION:
                raise WialonSessionError("Invalid Wialon session", code)
            raise WialonError(f"Wialon error {code} on {svc}", code)
        return data

    async def close(self) -> None:
        await self._http.aclose()