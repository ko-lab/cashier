from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    FRONTEND_HOST: str = "http://localhost:3000"
    DB_URI: str = "sqlite:///cashier.db"
    model_config = SettingsConfigDict()

settings = Settings()
