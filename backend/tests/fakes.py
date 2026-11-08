from typing import Any

from app.integrations.wialon.exceptions import WialonError


class Script(list):
    """Several answers for one service, given one per call. The last one repeats."""


class FakeWialonClient:
    """Stands in for WialonClient in tests: answers each service from `responses`
    and records every call, so tests can check exactly what was sent to Wialon.

    An answer that is an exception is raised instead of returned.
    """

    def __init__(self, responses: dict[str, Any]):
        self._responses = {
            svc: list(answer) if isinstance(answer, Script) else [answer]
            for svc, answer in responses.items()
        }
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def call(self, svc: str, params: dict[str, Any] | None = None) -> Any:
        self.calls.append((svc, params or {}))
        if svc not in self._responses:
            raise AssertionError(f"Unexpected Wialon call: {svc}")
        queue = self._responses[svc]
        answer = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(answer, Exception):
            raise answer
        return answer

    def params_of(self, svc: str) -> list[dict[str, Any]]:
        return [params for called, params in self.calls if called == svc]


def wialon_error(code: int) -> WialonError:
    return WialonError(f"Wialon error {code}", code)
