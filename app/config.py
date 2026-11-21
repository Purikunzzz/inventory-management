from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    GOOGLE_CLIENT_ID: str
    ADMIN_EMAILS: str = ""
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:4173"
    # Number of reverse proxies in front of the app that append to X-Forwarded-For.
    # 0 = trust only the socket peer (local dev); Render = 1.
    TRUSTED_PROXY_HOPS: int = 1
    # Local timezone for report day boundaries / printed timestamps.
    APP_TIMEZONE: str = "Asia/Bangkok"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
