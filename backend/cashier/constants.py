
APP_NAME = "cashier"
"""
Name of the application in short lowercase format.

This name will be used in the environment variables.
"""

IS_DEBUG: bool = False
"""
If enabled, activate extra logging procedures and debugging facilities.
"""

FRONTEND_HOST: str = "http://localhost:3000"
"""
The URL of the frontend.
"""

DB_URI: str = "sqlite:///cashier.db"
"""
How to connect for the database.
"""

# The code below is for automatically loading environment variables into the
# right constant. We do this by modding the ModuleType class that is used to
# represent modules like this.

import os
import sys
from types import ModuleType
import typing
from typing import Any

def _parse(text: str, ty: Any) -> Any:
    if ty is str:
        return text
    if ty is bool:
        return text and text != '0' and text != 'false'
    if ty is int:
        return int(text)
    raise RuntimeError(f'did not know how to parse type {ty}')

class EnvModule(ModuleType):

    def __getattribute__(self, name: str) -> Any:
        if not name.startswith('_'):
            hints = typing.get_type_hints(self)
            ty = hints.get(name)
            if ty is not None:
                env_key = f'{APP_NAME.upper()}_{name}'
                if env_key in os.environ:
                    return _parse(os.environ[env_key], ty)
        return super().__getattribute__(name)

sys.modules[__name__].__class__ = EnvModule
