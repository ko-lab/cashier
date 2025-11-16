from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from cashier.core.db.config import get_session
from cashier.models.products import ProductPublic, Product

router = APIRouter(tags=["products"], prefix="/products")


@router.get('/', response_model=list[ProductPublic])
def get_products(*, session: Session = Depends(get_session)):
    """
    Returns a list of all products
    :return:
    """
    products = session.exec(select(Product)).all()
    return products
