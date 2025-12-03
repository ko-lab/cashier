from fastapi import APIRouter, Depends
from sqlmodel import Session

from cashier.dependencies import get_session
import cashier.crud as crud
from cashier.models.products import ProductPublic

router = APIRouter(tags=["products"], prefix="/products")


@router.get('/', response_model=list[ProductPublic])
def get_products(*, session: Session = Depends(get_session)) -> list[Product]:
    """
    Returns a list of all products
    :return:
    """
    products = crud.list_products(session)
    return products
