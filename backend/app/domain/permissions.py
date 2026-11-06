from enum import StrEnum


class PermissionCode(StrEnum):
    VEHICLES_READ = "vehicles:read"
    VEHICLES_WRITE = "vehicles:write"
    DRIVERS_READ = "drivers:read"
    DRIVERS_WRITE = "drivers:write"
    PASSENGERS_READ = "passengers:read"
    PASSENGERS_WRITE = "passengers:write"
    HISTORY_READ = "history:read"
    DATA_EXPORT = "data:export"
    USERS_MANAGE = "users:manage"
    AUDIT_READ = "audit:read"


class RoleName(StrEnum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


_READ_ONLY = {
    PermissionCode.VEHICLES_READ,
    PermissionCode.DRIVERS_READ,
    PermissionCode.PASSENGERS_READ,
    PermissionCode.HISTORY_READ,
}

_OPERATIONS = _READ_ONLY | {
    PermissionCode.VEHICLES_WRITE,
    PermissionCode.DRIVERS_WRITE,
    PermissionCode.PASSENGERS_WRITE,
    PermissionCode.DATA_EXPORT,
}

DEFAULT_ROLE_PERMISSIONS: dict[RoleName, set[PermissionCode]] = {
    RoleName.ADMIN: set(PermissionCode),
    RoleName.OPERATOR: _OPERATIONS,
    RoleName.VIEWER: _READ_ONLY,
}