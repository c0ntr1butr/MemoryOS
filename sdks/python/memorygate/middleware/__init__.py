"""Framework-specific middleware for MemoryGate.

Every middleware here is *lazy*: it only imports the target framework inside
the constructor / call, so `pip install memorygate` alone stays lightweight.
Install the framework you use with the corresponding extra, e.g.::

    pip install memorygate[langgraph]
    pip install memorygate[openai]
    pip install memorygate[crewai]
    pip install memorygate[google]
    pip install memorygate[mcp]
"""
from importlib import import_module
from typing import Any


def _require(module: str, extra: str) -> Any:
    try:
        return import_module(module)
    except ModuleNotFoundError as e:
        raise RuntimeError(
            f"'{module}' is required for memorygate.middleware.{extra}. "
            f"Install it with:  pip install memorygate[{extra}]"
        ) from e


__all__ = ["_require"]
