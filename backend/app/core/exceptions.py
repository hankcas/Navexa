class AuthenticationError(Exception):
    """The request has no valid session, or the credentials are wrong."""


class PermissionDeniedError(Exception):
    """The user is authenticated but lacks the required permission."""