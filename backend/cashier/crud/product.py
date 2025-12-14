
from collections.abc import Sequence
from sqlmodel import Session, col, or_, select
from cashier.models.products import Product, PricingGroup, ProductPricing


__all__ = [
    'list_products_by_group',
]


def list_products_by_group(session: Session, group_name: str) -> Sequence[tuple[Product, ProductPricing]]:
    return session.exec(
        select(Product, ProductPricing)
            .outerjoin(ProductPricing)
            .outerjoin(PricingGroup)
            .where(or_(PricingGroup.name == group_name, col(PricingGroup.name).is_(None)))
    ).all()

