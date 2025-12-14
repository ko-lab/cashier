from collections.abc import Sequence
from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import UUID4, BaseModel
from sqlmodel import Session


from cashier.dependencies import get_session
import cashier.crud as crud
from cashier.models import Product
from cashier.models.products import ProductPricing


router = APIRouter(tags=["products"], prefix="/products")


class ProductView(BaseModel):
    id: UUID4
    ean: str | None
    price: Decimal


def render_product(product: Product, pricing: ProductPricing) -> ProductView:
    """
    Render only those fields that the user is allowed to see.
    """
    return ProductView(
        id=product.id,
        ean=product.ean,
        price=pricing.price if pricing is not None else product.base_price,
    )


@router.get('/')
async def get_products(*, group_name: str, session: Session = Depends(get_session)) -> Sequence[ProductView]:
    return [ render_product(product, pricing) for product, pricing in crud.list_products_by_group(session, group_name) ]
