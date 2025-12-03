from pydantic import UUID4
import uuid
from sqlmodel import Field, SQLModel

__all__ = [
    'Product',
    'ProductPublic',
]

class ProductBase(SQLModel):
    name: str = Field(nullable=False)
    price: float = Field(nullable=False)
    member_price: float = Field(nullable=False)
    ean: str = Field(nullable=False, index=True)
    img: str | None = Field(default=None)


class Product(ProductBase, table=True):
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)

class ProductPublic(ProductBase):
    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)
