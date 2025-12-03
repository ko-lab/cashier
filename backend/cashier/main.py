# SQLModel.metadata.create_all needs to have the SQLModels loaded in before creating them
import cashier.models

from fastapi import FastAPI
from sqlmodel import SQLModel

from cashier.core.db.config import engine
import cashier.api as api

SQLModel.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(api.product_router)
