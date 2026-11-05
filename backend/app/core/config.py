from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Navexa API"
    environment: str = "development"
    wialon_base_url: str
    wialon_token: str

    status_moving_speed_kmh: float = 5.0
    status_offline_minutes: int = 60


settings = Settings()