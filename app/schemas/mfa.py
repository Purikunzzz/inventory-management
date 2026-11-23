from pydantic import BaseModel, Field

from app.schemas.user import LoginResponse


class MfaTokenIn(BaseModel):
    mfa_token: str


class MfaCodeIn(BaseModel):
    mfa_token: str
    code: str = Field(min_length=1, max_length=32)  # 6-digit TOTP or a backup code


class MfaSetupOut(BaseModel):
    secret: str  # for typing in by hand when the QR can't be scanned
    otpauth_uri: str  # render as a QR code


class MfaEnableOut(LoginResponse):
    backup_codes: list[str]  # shown once; only hashes are stored


class MfaConfirmIn(BaseModel):
    code: str = Field(min_length=1, max_length=32)


class MfaStatusOut(BaseModel):
    enabled: bool
    backup_codes_remaining: int


class BackupCodesOut(BaseModel):
    backup_codes: list[str]
