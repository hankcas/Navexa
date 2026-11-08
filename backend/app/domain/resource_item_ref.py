import re
from dataclasses import dataclass

_PUBLIC_ID = re.compile(r"^(\d+)-(\d+)$")


@dataclass(frozen=True)
class ResourceItemRef:
    """Locates an item that lives inside a Wialon resource: a driver or a passenger (tag).

    Their Wialon ID is only unique inside the resource, so our public ID joins both
    numbers: "27668776-1" is item 1 of resource 27668776.
    """

    resource_id: int
    item_id: int

    @property
    def public_id(self) -> str:
        return f"{self.resource_id}-{self.item_id}"

    @classmethod
    def parse(cls, public_id: str) -> "ResourceItemRef | None":
        """Returns None for anything that is not "<resource>-<item>"."""
        match = _PUBLIC_ID.match(public_id)
        if not match:
            return None
        return cls(resource_id=int(match[1]), item_id=int(match[2]))
