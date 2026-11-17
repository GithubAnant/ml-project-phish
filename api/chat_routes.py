"""OpenRouter chat with URLSentinel tool calls."""

from __future__ import annotations

import json
import os
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.scoring import model_info_payload, predict_url

router = APIRouter(prefix="/chat", tags=["chat"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")

SYSTEM_PROMPT = """You are URLSentinel Copilot — explain phishing URL risk using the project's URL-only PhiUSIIL-trained model.

Rules:
- For any specific URL, call scan_url before claiming a verdict.
- Be concise. Plain language. Advisory tone — scores are not proof of malice.
- You can call get_model_info for metrics and scan_urls_batch for comparing multiple links.
"""

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "scan_url",
            "description": "Score a single URL with the URLSentinel URL-only model.",
            "parameters": {
                "type": "object",
                "properties": {"url": {"type": "string", "description": "Full URL or host to scan"}},
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "scan_urls_batch",
            "description": "Score up to 10 URLs and return sorted by phishing confidence.",
            "parameters": {
                "type": "object",
                "properties": {
                    "urls": {
                        "type": "array",
                        "items": {"type": "string"},
                        "maxItems": 10,
                    }
                },
                "required": ["urls"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_model_info",
            "description": "Return deployed model name, training date, and test metrics.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=40)


class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str]


def _run_tool(name: str, args: dict[str, Any]) -> str:
    try:
        if name == "scan_url":
            url = str(args.get("url", "")).strip()
            if not url.startswith("http"):
                url = f"https://{url.lstrip('/')}"
            return json.dumps(predict_url(url), indent=2)
        if name == "scan_urls_batch":
            raw = args.get("urls") or []
            results = []
            for u in raw[:10]:
                u = str(u).strip()
                if not u:
                    continue
                if not u.startswith("http"):
                    u = f"https://{u.lstrip('/')}"
                try:
                    results.append(predict_url(u))
                except Exception as exc:
                    results.append({"url": u, "error": str(exc)})
            results.sort(
                key=lambda r: (r.get("is_phishing", False), r.get("confidence", 0)),
                reverse=True,
            )
            return json.dumps(results, indent=2)
        if name == "get_model_info":
            return json.dumps(model_info_payload(), indent=2)
    except FileNotFoundError as exc:
        return json.dumps({"error": str(exc)})
    except Exception as exc:
        return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"Unknown tool {name}"})


def _openrouter_headers() -> dict[str, str]:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY not set. Export it before using chat.",
        )
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("OPENROUTER_REFERER", "http://localhost:3000"),
        "X-Title": "URLSentinel",
    }


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in body.messages:
        if m.role == "system":
            continue
        messages.append({"role": m.role, "content": m.content})

    tools_used: list[str] = []
    model = os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL)

    async with httpx.AsyncClient(timeout=90.0) as client:
        for _ in range(6):
            payload = {
                "model": model,
                "messages": messages,
                "tools": TOOLS,
                "tool_choice": "auto",
            }
            resp = await client.post(
                OPENROUTER_URL,
                headers=_openrouter_headers(),
                json=payload,
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"OpenRouter error {resp.status_code}: {resp.text[:500]}",
                )
            data = resp.json()
            choice = data["choices"][0]
            msg = choice["message"]

            tool_calls = msg.get("tool_calls") or []
            if not tool_calls:
                content = msg.get("content") or ""
                return ChatResponse(reply=content.strip(), tools_used=tools_used)

            messages.append(msg)
            for tc in tool_calls:
                fn = tc.get("function") or {}
                name = fn.get("name", "")
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                tools_used.append(name)
                result = _run_tool(name, args)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "content": result,
                    }
                )

    raise HTTPException(status_code=502, detail="Chat exceeded tool loop limit")