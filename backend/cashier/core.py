from sqlmodel import create_engine

from cashier.constants import IS_DEBUG

def build_engine(uri: str):
    return create_engine(
        uri,
        echo=IS_DEBUG,
        connect_args={ "check_same_thread": False }
    )

