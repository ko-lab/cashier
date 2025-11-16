from sqlmodel import create_engine, Session

from cashier.core.config import settings

engine = create_engine(str(settings.DB_URI), echo=True)

def get_session():
    with Session(engine) as session:
        yield session
