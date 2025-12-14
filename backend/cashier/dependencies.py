from typing import Annotated
from sqlmodel import Session
from fastapi import Depends, Request


def get_session(req: Request):
    with Session(req.app.state.engine) as session:
        yield session


type SessionDep = Annotated[Session, Depends(get_session)]
