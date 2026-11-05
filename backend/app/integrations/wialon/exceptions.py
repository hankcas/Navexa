class WialonError(Exception):
    """Base error for any Wialon failure."""

    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code = code


class WialonSessionError(WialonError):
    """The Wialon session is invalid or expired."""


class WialonUnavailableError(WialonError):
    """Wialon did not respond (timeout or network error)."""