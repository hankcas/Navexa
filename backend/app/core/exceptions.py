class AuthenticationError(Exception):
    """The request has no valid session, or the credentials are wrong."""


class PermissionDeniedError(Exception):
    """The user is authenticated but lacks the required permission."""

    
class BusinessRuleError(Exception):
    """A request is well formed but breaks a business rule."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message