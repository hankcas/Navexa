class AuthenticationError(Exception):
    """The request has no valid session, or the credentials are wrong."""


class PermissionDeniedError(Exception):
    """The user is authenticated but lacks the required permission."""


class RateLimitedError(Exception):
    """Too many attempts from the same client; it must wait before trying again."""

    def __init__(self, retry_after_seconds: float):
        super().__init__(f"Rate limited, retry after {retry_after_seconds:.0f}s")
        self.retry_after_seconds = retry_after_seconds


class BusinessRuleError(Exception):
    """A request is well formed but breaks a business rule."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 422,
        title: str = "Solicitud no válida",
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.title = title