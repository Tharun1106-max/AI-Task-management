"""AI Guardrails, Prompt Injection Detection & LLM Output Normalization."""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple, Type, TypeVar
from fastapi import HTTPException, status
from pydantic import BaseModel, ValidationError

logger = logging.getLogger("taskpilot.ai_guardrails")

T = TypeVar("T", bound=BaseModel)

# Known Prompt Injection & Jailbreak Signatures
PROMPT_INJECTION_PATTERNS = [
    r"(?i)ignore\s+(?:all\s+)?previous\s+instructions",
    r"(?i)disregard\s+(?:all\s+)?previous\s+(?:instructions|rules|prompts)",
    r"(?i)forget\s+(?:all\s+)?prior\s+instructions",
    r"(?i)override\s+(?:all\s+)?system\s+rules",
    r"(?i)bypass\s+(?:all\s+)?safety\s+(?:filters|protocols|guidelines)",
    r"(?i)you\s+are\s+now\s+in\s+developer\s+mode",
    r"(?i)dan\s+mode|do\s+anything\s+now",
    r"(?i)jailbreak",
    r"<\|im_start\|>",
    r"<\|im_end\|>",
    r"\[INST\]",
    r"\[/INST\]",
    r"<<SYS>>",
    r"<</SYS>>",
    r"(?i)^system\s*:\s*",
    r"(?i)you\s+must\s+ignore\s+your\s+ethical\s+guidelines",
]

COMPILED_INJECTION_REGEX = [re.compile(pat) for pat in PROMPT_INJECTION_PATTERNS]

APPROVED_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
APPROVED_STATUSES = {"TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED"}


def detect_prompt_injection(text: str) -> Tuple[bool, Optional[str]]:
    """Scans text for prompt injection, jailbreak, or system override attempts.

    Returns:
        Tuple[is_malicious: bool, matched_pattern: Optional[str]]
    """
    if not text:
        return False, None

    for regex in COMPILED_INJECTION_REGEX:
        match = regex.search(text)
        if match:
            return True, match.group(0)

    return False, None


def sanitize_user_prompt(text: str, strict: bool = True) -> str:
    """Sanitizes user-submitted prompt or documentation input.

    If `strict=True`, raises an HTTP 400 exception if hazardous prompt injection is identified.
    Otherwise, neutralizes dangerous delimiter tokens.
    """
    if not text:
        return ""

    is_injection, matched = detect_prompt_injection(text)
    if is_injection:
        logger.warning("Prompt injection signature intercepted: '%s'", matched)
        if strict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security alert: Prompt rejected due to unauthorized override pattern ('{matched}'). Please rephrase your input.",
            )

    # Neutralize control characters and delimiter artifacts
    cleaned = text
    cleaned = re.sub(r"<\|im_start\|>", "[neutralized_tag]", cleaned)
    cleaned = re.sub(r"<\|im_end\|>", "[neutralized_tag]", cleaned)
    cleaned = re.sub(r"\[/?INST\]", "[neutralized_tag]", cleaned)
    cleaned = re.sub(r"\[/?SYS\]", "[neutralized_tag]", cleaned)

    return cleaned.strip()


def sanitize_ai_output_dict(obj: Any) -> Any:
    """Recursively walks a raw JSON dictionary produced by an LLM and normalizes
    unapproved priority or status enum values to safe defaults.
    """
    if isinstance(obj, dict):
        cleaned: Dict[str, Any] = {}
        for k, v in obj.items():
            key_lower = k.lower()
            if key_lower == "priority" and isinstance(v, str):
                v_upper = v.strip().upper()
                cleaned[k] = v_upper if v_upper in APPROVED_PRIORITIES else "MEDIUM"
            elif key_lower == "status" and isinstance(v, str):
                v_upper = v.strip().upper()
                cleaned[k] = v_upper if v_upper in APPROVED_STATUSES else "TODO"
            elif key_lower in ["tags", "dependencies", "milestones", "tasks", "identified_risks"]:
                cleaned[k] = sanitize_ai_output_dict(v) if v is not None else []
            else:
                cleaned[k] = sanitize_ai_output_dict(v)
        return cleaned

    if isinstance(obj, list):
        return [sanitize_ai_output_dict(item) for item in obj]

    return obj


def validate_and_sanitize_model(raw_data: Any, model_cls: Type[T]) -> T:
    """Validates raw LLM dictionary against target Pydantic schema with automated normalization."""
    cleaned_dict = sanitize_ai_output_dict(raw_data)

    try:
        return model_cls.model_validate(cleaned_dict)
    except ValidationError as err:
        logger.warning(
            "Pydantic validation failed for [%s]: %s. Applying fallback default repairs.",
            model_cls.__name__,
            err,
        )
        # Attempt repair for missing top-level list keys
        if isinstance(cleaned_dict, dict):
            for field_name, field_info in model_cls.model_fields.items():
                if field_name not in cleaned_dict or cleaned_dict[field_name] is None:
                    # Provide empty lists or safe defaults
                    if getattr(field_info.annotation, "__origin__", None) is list:
                        cleaned_dict[field_name] = []
                    elif field_info.annotation is str:
                        cleaned_dict[field_name] = ""

        # Re-attempt validation
        return model_cls.model_validate(cleaned_dict)
