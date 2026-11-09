from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Navexa API"
    environment: str = "development"
    wialon_base_url: str
    wialon_token: str
    # Resource where new drivers and passengers are created. Empty: the first one the token sees.
    wialon_resource_id: int | None = None
    database_url: str

    status_moving_speed_kmh: float = 5.0
    status_offline_minutes: int = 60
    
    first_admin_email: str | None = None
    first_admin_password: str | None = None
    first_admin_name: str = "Administrador"
    
    jwt_secret: str
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    # Login attempts allowed per IP in the window, on top of the per-account lock (SEG-07).
    login_rate_limit_attempts: int = 10
    login_rate_limit_window_seconds: int = 300
    cookie_secure: bool = True
    cookie_samesite: str = "lax"

    # Browsers reach the API through the Vercel proxy (same origin), so no origin is needed.
    # If one is ever needed, list it here; nothing else is allowed (DEP-03).
    cors_origins: list[str] = []
    # Swagger UI and the OpenAPI schema. Every endpoint is protected anyway; set to false to
    # hide the documentation in production (SEG-05).
    docs_enabled: bool = True

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()