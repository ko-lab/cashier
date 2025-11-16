import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool
from sqlmodel import create_engine, SQLModel, Session

from cashier.core.db.config import get_session
from cashier.main import app
from cashier.models.products import Product


@pytest.fixture(name="session", autouse=True)
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client", autouse=True)
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="data", autouse=True)
def data_fixture(session: Session):
    products = [Product(name='Product Test 1', price=10.0, member_price=0.2, ean='2052552', img=None)]
    for product in products:
        session.add(product)
        session.commit()
        session.refresh(product)
