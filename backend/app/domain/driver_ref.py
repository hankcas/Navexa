import re
from dataclasses import dataclass

_PUBLIC_ID = re.compile(r"^(\d+)-(\d+)$")


@dataclass(frozen=True)
class DriverRef:
    """Locates a driver in Wialon.

    A Wialon driver ID is only unique inside its resource, so our public ID joins
    both numbers: "27668776-1" is driver 1 of resource 27668776.
    """

    resource_id: int
    driver_id: int

    @property
    def public_id(self) -> str:
        return f"{self.resource_id}-{self.driver_id}"

    @classmethod
    def parse(cls, public_id: str) -> "DriverRef | None":
        """Returns None for anything that is not "<resource>-<driver>"."""
        match = _PUBLIC_ID.match(public_id)
        if not match:
            return None
        return cls(resource_id=int(match[1]), driver_id=int(match[2]))
