from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict
import re

class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120, description="Full Name of the user")
    email: str = Field(..., min_length=5, max_length=120, description="Valid user email address")
    password: str = Field(..., min_length=6, max_length=128, description="Password with minimum 6 characters")
    confirm_password: str = Field(..., min_length=6, max_length=128, description="Matching password confirmation")
    role: Optional[str] = Field(default="Lead Project Engineer", max_length=60, description="Assigned organizational role")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean_email = v.strip().lower()
        email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(email_regex, clean_email):
            raise ValueError("Please provide a valid email address.")
        return clean_email

    @field_validator("confirm_password")
    @classmethod
    def validate_passwords_match(cls, v: str, values) -> str:
        # Pydantic v2 validation
        if "password" in values.data and v != values.data["password"]:
            raise ValueError("Passwords do not match.")
        return v

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1, description="User email address")
    password: str = Field(..., min_length=1, description="User password")

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class MessageResponse(BaseModel):
    message: str
    status: str = "success"
    user: Optional[UserResponse] = None
