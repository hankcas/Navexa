from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Navexa API"
    environment: str = "development"
    wialon_base_url: str
    wialon_token: str
    database_url: str

    status_moving_speed_kmh: float = 5.0
    status_offline_minutes: int = 60
    
    first_admin_email: str | None = None
    first_admin_password: str | None = None
    first_admin_name: str = "Administrador"
    
    jwt_secret: str
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    cookie_secure: bool = True
    cookie_samesite: str = "lax"


settings = Settings()