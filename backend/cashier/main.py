from cashier.api.products import router as product_router
# SQLModel.metadata.create_all needs to have the SQLModels loaded in before creating them
# TODO: Find a better way of handling this
from cashier.models import products
from fastapi import FastAPI
from sqlmodel import SQLModel
from cashier.core.db.config import engine

SQLModel.metadata.create_all(bind=engine)
app = FastAPI()
app.include_router(product_router)
