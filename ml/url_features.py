"""URL-only feature extraction from raw URL strings (no page/crawl features)."""

from __future__ import annotations

import re
from urllib.parse import urlparse

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin

SUSPICIOUS_TLDS = frozenset(
    {
        "zip",
        "mov",
        "top",
        "xyz",
        "cam",
        "work",
        "click",
        "link",
        "gq",
        "tk",
        "ml",
        "cf",
        "ga",
        "rest",
        "monster",
        "sbs",
    }
)

FEATURE_NAMES = [
    "url_length",
    "domain_length",
    "path_length",
    "query_length",
    "num_subdomains",
    "tld_length",
    "is_https",
    "is_ip_host",
    "has_at_symbol",
    "has_double_slash_path",
    "num_digits",
    "digit_ratio",
    "num_letters",
    "letter_ratio",
    "num_special",
    "special_ratio",
    "num_equals",
    "num_question",
    "num_ampersand",
    "num_hyphen",
    "num_dots",
    "num_percent",
    "has_port",
    "suspicious_tld",
    "keyword_login",
    "keyword_secure",
    "keyword_verify",
    "keyword_account",
    "keyword_update",
    "keyword_free",
    "entropy",
]


def _shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    _, counts = np.unique(list(s), return_counts=True)
    probs = counts / len(s)
    return float(-np.sum(probs * np.log2(probs)))


def extract_url_features(url: str) -> dict[str, float]:
    raw = (url or "").strip()
    lower = raw.lower()
    parsed = urlparse(raw if "://" in raw else f"http://{raw}")
    host = parsed.netloc or ""
    path = parsed.path or ""
    query = parsed.query or ""
    full_path = f"{path}?{query}" if query else path

    host_no_port = host.split(":")[0] if host else ""
    labels = [p for p in host_no_port.split(".") if p]
    tld = labels[-1] if labels else ""
    subdomains = max(0, len(labels) - 2) if len(labels) >= 2 else 0

    ip_like = bool(re.match(r"^(\d{1,3}\.){3}\d{1,3}$", host_no_port))
    digits = sum(c.isdigit() for c in raw)
    letters = sum(c.isalpha() for c in raw)
    length = max(len(raw), 1)

    keywords = {
        "keyword_login": "login",
        "keyword_secure": "secure",
        "keyword_verify": "verify",
        "keyword_account": "account",
        "keyword_update": "update",
        "keyword_free": "free",
    }

    feats: dict[str, float] = {
        "url_length": float(len(raw)),
        "domain_length": float(len(host_no_port)),
        "path_length": float(len(path)),
        "query_length": float(len(query)),
        "num_subdomains": float(subdomains),
        "tld_length": float(len(tld)),
        "is_https": 1.0 if parsed.scheme.lower() == "https" else 0.0,
        "is_ip_host": 1.0 if ip_like else 0.0,
        "has_at_symbol": 1.0 if "@" in raw else 0.0,
        "has_double_slash_path": 1.0 if "//" in full_path.replace("://", "") else 0.0,
        "num_digits": float(digits),
        "digit_ratio": digits / length,
        "num_letters": float(letters),
        "letter_ratio": letters / length,
        "num_special": float(
            sum(not c.isalnum() for c in raw)
        ),
        "special_ratio": sum(not c.isalnum() for c in raw) / length,
        "num_equals": float(raw.count("=")),
        "num_question": float(raw.count("?")),
        "num_ampersand": float(raw.count("&")),
        "num_hyphen": float(raw.count("-")),
        "num_dots": float(raw.count(".")),
        "num_percent": float(raw.count("%")),
        "has_port": 1.0 if ":" in host and not ip_like else 0.0,
        "suspicious_tld": 1.0 if tld.lower() in SUSPICIOUS_TLDS else 0.0,
        "entropy": _shannon_entropy(raw),
    }
    for key, word in keywords.items():
        feats[key] = 1.0 if word in lower else 0.0
    return feats


class URLFeatureExtractor(BaseEstimator, TransformerMixin):
    """Sklearn transformer: array of URL strings -> numeric matrix."""

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        rows = []
        for url in X:
            feats = extract_url_features(str(url))
            rows.append([feats[name] for name in FEATURE_NAMES])
        return np.asarray(rows, dtype=np.float64)

    def get_feature_names_out(self, input_features=None):
        return np.array(FEATURE_NAMES, dtype=object)
