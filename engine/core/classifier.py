"""
classifier.py — Input classification & context awareness.
Identifies parameter types, validation patterns, and maps inputs to attack vectors.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from enum import Enum


class InputType(Enum):
    TEXT = "text"
    NUMERIC = "numeric"
    EMAIL = "email"
    URL = "url"
    JSON = "json"
    XML = "xml"
    FILE_PATH = "file_path"
    HTML = "html"
    SQL_LIKE = "sql_like"
    COMMAND = "command"
    TOKEN = "token"
    PASSWORD = "password"
    BOOLEAN = "boolean"
    DATE = "date"
    ID = "id"
    UNKNOWN = "unknown"


class AttackVector(Enum):
    SQLI = "sqli"
    XSS = "xss"
    SSTI = "ssti"
    RCE = "rce"
    IDOR = "idor"
    SSRF = "ssrf"
    LFI = "lfi"
    OPEN_REDIRECT = "open_redirect"
    CSRF = "csrf"
    AUTH_BYPASS = "auth_bypass"
    HEADER_INJECTION = "header_injection"


@dataclass
class ClassifiedInput:
    """A classified input parameter."""
    name: str
    value: str
    input_type: InputType
    location: str              # query, body, header, cookie, path
    attack_vectors: list[AttackVector] = field(default_factory=list)
    confidence: float = 0.0    # 0-1 confidence in classification
    context: str = ""          # additional context


# ── Type detection patterns ──

_PATTERNS: list[tuple[InputType, re.Pattern, float]] = [
    (InputType.EMAIL, re.compile(r'^[\w.+-]+@[\w-]+\.[\w.]+$'), 0.95),
    (InputType.URL, re.compile(r'^https?://'), 0.9),
    (InputType.NUMERIC, re.compile(r'^-?\d+(\.\d+)?$'), 0.9),
    (InputType.BOOLEAN, re.compile(r'^(true|false|0|1|yes|no)$', re.I), 0.85),
    (InputType.DATE, re.compile(r'^\d{4}-\d{2}-\d{2}'), 0.85),
    (InputType.JSON, re.compile(r'^\s*[\[{]'), 0.8),
    (InputType.XML, re.compile(r'^\s*<'), 0.8),
    (InputType.FILE_PATH, re.compile(r'^[/\\][\w./\\-]+'), 0.7),
    (InputType.TOKEN, re.compile(r'^[A-Za-z0-9_-]{20,}$'), 0.6),
]

# ── Name-based hints ──

_NAME_HINTS: dict[str, tuple[InputType, list[AttackVector]]] = {
    "id": (InputType.ID, [AttackVector.IDOR, AttackVector.SQLI]),
    "user_id": (InputType.ID, [AttackVector.IDOR]),
    "uid": (InputType.ID, [AttackVector.IDOR]),
    "userId": (InputType.ID, [AttackVector.IDOR]),
    "q": (InputType.TEXT, [AttackVector.XSS, AttackVector.SQLI]),
    "query": (InputType.TEXT, [AttackVector.XSS, AttackVector.SQLI]),
    "search": (InputType.TEXT, [AttackVector.XSS, AttackVector.SQLI]),
    "url": (InputType.URL, [AttackVector.SSRF, AttackVector.OPEN_REDIRECT]),
    "redirect": (InputType.URL, [AttackVector.OPEN_REDIRECT]),
    "next": (InputType.URL, [AttackVector.OPEN_REDIRECT]),
    "return": (InputType.URL, [AttackVector.OPEN_REDIRECT]),
    "callback": (InputType.URL, [AttackVector.SSRF]),
    "file": (InputType.FILE_PATH, [AttackVector.LFI]),
    "path": (InputType.FILE_PATH, [AttackVector.LFI]),
    "include": (InputType.FILE_PATH, [AttackVector.LFI]),
    "page": (InputType.FILE_PATH, [AttackVector.LFI]),
    "template": (InputType.TEXT, [AttackVector.SSTI]),
    "name": (InputType.TEXT, [AttackVector.XSS, AttackVector.SSTI]),
    "comment": (InputType.TEXT, [AttackVector.XSS]),
    "message": (InputType.TEXT, [AttackVector.XSS]),
    "cmd": (InputType.COMMAND, [AttackVector.RCE]),
    "exec": (InputType.COMMAND, [AttackVector.RCE]),
    "command": (InputType.COMMAND, [AttackVector.RCE]),
    "host": (InputType.TEXT, [AttackVector.RCE, AttackVector.SSRF]),
    "ip": (InputType.TEXT, [AttackVector.RCE, AttackVector.SSRF]),
    "email": (InputType.EMAIL, [AttackVector.SQLI, AttackVector.XSS]),
    "username": (InputType.TEXT, [AttackVector.SQLI, AttackVector.AUTH_BYPASS]),
    "password": (InputType.PASSWORD, [AttackVector.AUTH_BYPASS]),
    "token": (InputType.TOKEN, [AttackVector.AUTH_BYPASS]),
    "sort": (InputType.TEXT, [AttackVector.SQLI]),
    "order": (InputType.TEXT, [AttackVector.SQLI]),
    "column": (InputType.TEXT, [AttackVector.SQLI]),
    "table": (InputType.TEXT, [AttackVector.SQLI]),
}

# ── Default attack vectors per input type ──

_TYPE_VECTORS: dict[InputType, list[AttackVector]] = {
    InputType.TEXT: [AttackVector.XSS, AttackVector.SQLI, AttackVector.SSTI],
    InputType.NUMERIC: [AttackVector.SQLI, AttackVector.IDOR],
    InputType.EMAIL: [AttackVector.SQLI, AttackVector.XSS],
    InputType.URL: [AttackVector.SSRF, AttackVector.OPEN_REDIRECT],
    InputType.JSON: [AttackVector.SQLI, AttackVector.XSS, AttackVector.RCE],
    InputType.XML: [AttackVector.XSS, AttackVector.RCE],
    InputType.FILE_PATH: [AttackVector.LFI, AttackVector.RCE],
    InputType.HTML: [AttackVector.XSS],
    InputType.SQL_LIKE: [AttackVector.SQLI],
    InputType.COMMAND: [AttackVector.RCE],
    InputType.TOKEN: [AttackVector.AUTH_BYPASS],
    InputType.PASSWORD: [AttackVector.AUTH_BYPASS],
    InputType.BOOLEAN: [AttackVector.AUTH_BYPASS],
    InputType.DATE: [AttackVector.SQLI],
    InputType.ID: [AttackVector.IDOR, AttackVector.SQLI],
    InputType.UNKNOWN: [AttackVector.XSS, AttackVector.SQLI],
}


class InputClassifier:
    """Classifies inputs and maps them to attack vectors."""

    def classify(self, name: str, value: str, location: str = "query") -> ClassifiedInput:
        """Classify a single input parameter."""
        input_type = InputType.UNKNOWN
        confidence = 0.0
        vectors: list[AttackVector] = []

        # 1. Check name-based hints first (highest priority)
        name_lower = name.lower().strip()
        if name_lower in _NAME_HINTS:
            hint_type, hint_vectors = _NAME_HINTS[name_lower]
            input_type = hint_type
            vectors = hint_vectors.copy()
            confidence = 0.85

        # 2. Check value patterns
        for pat_type, pattern, pat_conf in _PATTERNS:
            if pattern.match(value):
                if pat_conf > confidence:
                    input_type = pat_type
                    confidence = pat_conf
                break

        # 3. Add default vectors for the detected type
        type_vectors = _TYPE_VECTORS.get(input_type, [])
        for v in type_vectors:
            if v not in vectors:
                vectors.append(v)

        # 4. Location-specific vectors
        if location == "header":
            if AttackVector.HEADER_INJECTION not in vectors:
                vectors.append(AttackVector.HEADER_INJECTION)
        elif location == "cookie":
            if AttackVector.AUTH_BYPASS not in vectors:
                vectors.append(AttackVector.AUTH_BYPASS)

        return ClassifiedInput(
            name=name,
            value=value,
            input_type=input_type,
            location=location,
            attack_vectors=vectors,
            confidence=confidence,
            context=f"{input_type.value} in {location}",
        )

    def classify_all(
        self,
        params: dict[str, str],
        location: str = "query",
    ) -> list[ClassifiedInput]:
        """Classify all parameters."""
        return [self.classify(k, v, location) for k, v in params.items()]
