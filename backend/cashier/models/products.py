from datetime import datetime
from decimal import Decimal
from pydantic import UUID4
import uuid
import sqlalchemy
from sqlmodel import Field, Relationship, SQLModel

__all__ = [
    'Product',
    'PricingGroup',
    'ProductPricing',
]


class PricingGroup(SQLModel, table=True):

    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)

    name: str
    """
    The name of the group as it should be displayed in the interface.
    """

    created_at: datetime | None = Field(
        default=None,
        sa_type=sqlalchemy.DateTime,
        sa_column_kwargs={"server_default": sqlalchemy.func.now()},
    )
    """
    Date and time when this order line was registered into the system.
    """

    updated_at: datetime | None = Field(
        default=None,
        sa_type=sqlalchemy.DateTime,
        sa_column_kwargs={"onupdate": sqlalchemy.func.now(), "server_default": sqlalchemy.func.now()},
    )
    """
    Date and time of the most recent change to any of the fields of this order.
    """

    product_pricings: list['ProductPricing'] = Relationship(back_populates='pricing_group')


class ProductPricing(SQLModel, table=True):

    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)

    product_id: UUID4 = Field(foreign_key='product.id')
    """
    The ID of the product to which the price is applied.
    """

    pricing_group_id: UUID4 = Field(foreign_key='pricinggroup.id')
    """
    The ID of the group that may get the discounted price.
    """

    price: Decimal
    """
    The overriden price of one unit of the product.
    """

    product: 'Product' = Relationship(back_populates='pricings')
    pricing_group: PricingGroup = Relationship(back_populates='product_pricings')


class Product(SQLModel, table=True):

    id: UUID4 = Field(default_factory=uuid.uuid4, primary_key=True)

    name: str
    """
    The name of the item as it will be displayed in the interface.
    """

    base_price: Decimal
    """
    The price of one unit of the product if not other pricing is found.
    """

    stock: int
    """
    Count of items that can be bought.
    """

    image_path: str | None = None
    """
    A relative path name to the image that represents the product.
    """

    ean: str = Field(nullable=False, index=True)
    """
    The offcial EAN code of the product.

    Useful for scanning barcodes.
    """

    created_at: datetime | None = Field(
        default=None,
        sa_type=sqlalchemy.DateTime,
        sa_column_kwargs={"server_default": sqlalchemy.func.now()},
    )
    """
    Date and time when this order was registered into the system.
    """

    updated_at: datetime | None = Field(
        default=None,
        sa_type=sqlalchemy.DateTime,
        sa_column_kwargs={"onupdate": sqlalchemy.func.now(), "server_default": sqlalchemy.func.now()},
    )
    """
    Date and time of the most recent change to any of the fields of this order.
    """

    pricings: list[ProductPricing] = Relationship(back_populates='product')
