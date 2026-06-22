from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(
        ...,
        validation_alias="DATABASE_URL",
        description="SQLAlchemy-compatible database connection URL.",
    )


# Singleton instance — import this everywhere instead of instantiating Settings directly.
settings = Settings()
