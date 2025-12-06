from collections.abc import Sequence
from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import UUID4, BaseModel
from sqlmodel import Session


from cashier.dependencies import get_session
import cashier.crud as crud
from cashier.models import Product


router = APIRouter(tags=["products"], prefix="/products")


class ProductView(BaseModel):
    id: UUID4
    ean: str | None
    price: Decimal


def render_product(product: Product) -> ProductView:
    """
    Render only those fields that the user is allowed to see.
    """
    return ProductView(
        id=product.id,
        ean=product.ean,
        price=product.price,
    )


@router.get('/')
async def get_products(*, session: Session = Depends(get_session)) -> Sequence[ProductView]:
    return [ render_product(product) for product in crud.list_products(session) ]
