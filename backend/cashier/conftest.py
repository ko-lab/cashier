from decimal import Decimal
from uuid import UUID
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session

from cashier.core import build_engine
from cashier.dependencies import get_session
from cashier.main import app
from cashier.models import Product, PricingGroup
from cashier.models.products import ProductPricing


@pytest.fixture(name="session", autouse=True)
def session_fixture():
    engine = build_engine("sqlite://")
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

    orval = Product(
        id=UUID('c4a83023-c9ea-443c-bb56-f2b6f4c7cc5e'),
        name='Orval trappist 33cl',
        stock=5,
        base_price=Decimal('2.10'),
        ean='3606502246884',
    )
    trappist = Product(
        id=UUID('8466741b-b44f-42b5-9977-550bc7292dd7'),
        name="Trappist",
        stock=7,
        base_price=Decimal('3.80'),
        ean='5410908000029',
    )
    members = PricingGroup(
        id=UUID('41bec26e-f6ab-4bb8-98c9-0c3468cfd005'),
        name="Members",
    )
    vip = PricingGroup(
        id=UUID('4e4c8d9e-7568-4b2f-a870-0972869498dc'),
        name="VIP",
    )
    orval_members = ProductPricing(
        pricing_group_id=members.id,
        product_id=orval.id,
        price=Decimal('1.90'),
    )
    orval_vip = ProductPricing(
        pricing_group_id=vip.id,
        product_id=orval.id,
        price=Decimal('1.50'),
    )

    models = [ orval, trappist, members, vip, orval_members, orval_vip ]

    for model in models:
        session.add(model)
    session.commit()
    for model in models:
        session.refresh(model)
