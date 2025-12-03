
from collections.abc import Sequence
from sqlmodel import Session, select
from cashier.models.products import Product

__all__ = [
    'list_products',
]


def list_products(session: Session) -> Sequence[Product]:
    return session.exec(select(Product)).all()

