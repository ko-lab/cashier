from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlmodel import SQLModel

# SQLModel.metadata.create_all needs to have the SQLModels loaded in before creating them
from cashier.constants import DB_URI
from cashier.core import build_engine
import cashier.models
import cashier.api as api

@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = build_engine(DB_URI)
    SQLModel.metadata.create_all(engine)
    app.state.engine = engine
    yield
    engine.dispose()


app = FastAPI(lifespan=lifespan)


app.include_router(api.product_router)
