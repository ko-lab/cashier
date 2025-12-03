from sqlmodel import create_engine

from cashier.constants import DB_URI, DEVELOPMENT

engine = create_engine(DB_URI, echo=DEVELOPMENT)
