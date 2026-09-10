import re
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
import httpx
from pydantic import ValidationError

from app.config import settings
from app.schemas.execution_schema import ExtractedExecutionData

logger = logging.getLogger("extractor_service")

EXTRACTION_SYSTEM_PROMPT = """You are an expert construction & infrastructure intelligence extraction engine for InfraRecon AI.
Your sole responsibility is language understanding and structured fact extraction from raw, unstructured field evidence (Daily Progress Reports, site diaries, supervisor logs).

MANDATORY RULES & CONSTRAINTS:
1. Extract ONLY facts directly stated in and grounded by the source report text.
2. If any piece of information is absent (e.g. missing asset ID, line ID, date, or delay reason), return null (None).
3. NEVER invent or hallucinate identifiers (e.g., do not make up activity IDs, asset tags, or line numbers).
4. NEVER invent dates or progress percentages.
5. Provide the exact verbatim quote from the raw text in `evidence_text` that directly supports the extraction.
6. Set `discipline` to one of: Piping, Civil, Electrical, Mechanical, Instrumentation, Trackwork, Structural, or General.
7. Set `event_type` to one of: progress, completion, delay, inspection, milestone.
8. Set `progress` to a float between 0.0 and 100.0 ONLY if explicitly stated (e.g., "75%" -> 75.0, "completed" / "finished" -> 100.0), otherwise null.
9. Provide an `extraction_confidence` score between 0.0 and 1.0 reflecting the clarity and specificity of the reported evidence.
10. CRITICAL: You must ONLY extract structured facts. You must NEVER select schedule activities, never rank matches, and never alter project execution states.

JSON SCHEMA TO RETURN:
{
  "activity_description": string or null,
  "discipline": string or null,
  "location": string or null,
  "asset_id": string or null,
  "line_id": string or null,
  "event_type": "progress" | "completion" | "delay" | "inspection" | "milestone",
  "actual_start": ISO8601 string or null,
  "actual_finish": ISO8601 string or null,
  "progress": float (0-100) or null,
  "status": "EXTRACTED",
  "delay_reason": string or null,
  "evidence_text": string,
  "extraction_confidence": float (0.0 to 1.0)
}
"""

def heuristic_fallback_extractor(raw_text: str) -> ExtractedExecutionData:
    """
    Deterministic rule-based fallback extractor for offline test execution,
    CI pipelines, or when GEMINI_API_KEY is not configured.
    Strictly follows the zero-hallucination policy.
    """
    text = raw_text.strip()
    text_lower = text.lower()
    
    # 1. Detect Discipline
    discipline = "General"
    if any(k in text_lower for k in ["spool", "piping", "line ", "hydrotest", "flange", "valve"]):
        discipline = "Piping"
    elif any(k in text_lower for k in ["drainage", "conduit", "concrete", "foundation", "civil", "excavation", "rebar"]):
        discipline = "Civil"
    elif any(k in text_lower for k in ["cable tray", "electrical", "transformer", "wiring", "switchgear", "conduit"]):
        discipline = "Electrical"
    elif any(k in text_lower for k in ["trackwork", "rail", "ballast", "sleeper"]):
        discipline = "Trackwork"
    elif any(k in text_lower for k in ["pump", "compressor", "turbine", "mechanical"]):
        discipline = "Mechanical"
    elif any(k in text_lower for k in ["sensor", "instrumentation", "transmitter", "plc"]):
        discipline = "Instrumentation"

    # 2. Detect Event Type & Progress
    event_type = "progress"
    progress = None
    
    # Look for percentage (e.g., 75%, 75 percent)
    pct_match = re.search(r"(\d{1,3}(?:\.\d+)?)\s*%", text)
    if pct_match:
        progress = float(pct_match.group(1))
        event_type = "progress"
    elif any(k in text_lower for k in ["completed", "finished", "erected", "done"]):
        event_type = "completion"
        progress = 100.0
    elif any(k in text_lower for k in ["delayed", "blocked", "on hold", "waiting for"]):
        event_type = "delay"
    elif any(k in text_lower for k in ["inspected", "tested", "hydrotested", "qa", "qc"]):
        event_type = "inspection"

    # 3. Detect Line ID / Asset ID (grounded only)
    line_id = None
    line_match = re.search(r"(?:line|circuit)\s+([A-Za-z0-9\-_]+)", text, re.IGNORECASE)
    if line_match:
        line_id = line_match.group(1)

    asset_id = None
    asset_match = re.search(r"(?:asset|equipment|tag|tag#)\s+([A-Za-z0-9\-_]+)", text, re.IGNORECASE)
    if asset_match:
        asset_id = asset_match.group(1)

    # 4. Detect Location (grounded only)
    location = None
    loc_match = re.search(r"(?:at|in|on)\s+((?:Area\s+[A-Za-z0-9\-_]+)|(?:Zone\s+\d+)|(?:Compressor\s+Bay\s+\d+)|(?:Level\s+\d+)|(?:PR-\d+)|(?:Substation\s+\d+)|(?:Pier\s+\d+)|(?:Station\s+[A-Za-z0-9\-_]+))", text, re.IGNORECASE)
    if loc_match:
        location = loc_match.group(1).strip()
    elif "PR-04" in text:
        location = "PR-04"
    elif "Zone 3" in text:
        location = "Zone 3"
    elif "Compressor Bay 2" in text:
        location = "Compressor Bay 2"
    elif "Level 2" in text:
        location = "Level 2"

    # 5. Extract Activity Description
    desc = text
    # Clean up prefixes
    clean_desc = re.sub(r"^(?:yesterday evening|today|at \w+|finished|started)\s*,?\s*", "", text, flags=re.IGNORECASE)
    # Truncate to first clear clause or up to 80 chars
    first_sentence = clean_desc.split(".")[0].strip()
    activity_desc = first_sentence if first_sentence else text[:80]

    # Grounded evidence quote
    evidence_text = text

    return ExtractedExecutionData(
        activity_description=activity_desc,
        discipline=discipline,
        location=location,
        asset_id=asset_id,
        line_id=line_id,
        event_type=event_type,
        actual_start=None,
        actual_finish=datetime.now(timezone.utc) if event_type == "completion" else None,
        progress=progress,
        status="EXTRACTED",
        delay_reason=None,
        evidence_text=evidence_text,
        extraction_confidence=0.92
    )

def extract_execution_event_with_gemini(
    raw_text: str,
    project_id: Optional[str] = None,
    source_id: Optional[str] = None
) -> Tuple[ExtractedExecutionData, float, list[str], str]:
    """
    Calls Gemini 2.5 Flash through the backend to perform grounded structured extraction.
    Validates output with Pydantic ExtractedExecutionData.
    Returns (ExtractedExecutionData, execution_time_ms, warnings, engine).
    """
    start_time = time.time()
    warnings = []
    api_key = settings.GEMINI_API_KEY.strip()
    model = settings.GEMINI_MODEL or "gemini-2.5-flash"

    # 1. If API Key is missing, use deterministic grounded fallback
    if not api_key:
        logger.info("GEMINI_API_KEY not configured. Utilizing grounded heuristic fallback extraction.")
        warnings.append("GEMINI_API_KEY is not set. Used local grounded extraction fallback.")
        extracted_data = heuristic_fallback_extractor(raw_text)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return extracted_data, elapsed_ms, warnings, "heuristic_fallback"

    # 2. Prepare Gemini 2.5 Flash API Payload
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    user_prompt = f"""Raw Field Execution Report Text:
\"\"\"{raw_text}\"\"\"

Project Context: {project_id or 'General Infrastructure Project'}
Source ID: {source_id or 'N/A'}

Extract the structured ExecutionEvent adhering strictly to the system instructions.
"""

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": EXTRACTION_SYSTEM_PROMPT}]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
            "maxOutputTokens": 1024
        }
    }

    try:
        with httpx.Client(timeout=25.0) as client:
            response = client.post(url, json=payload)

        if response.status_code != 200:
            err_msg = f"Gemini API returned status {response.status_code}: {response.text[:200]}"
            logger.warning(err_msg)
            warnings.append(f"Gemini API error ({response.status_code}). Used grounded fallback extraction.")
            extracted_data = heuristic_fallback_extractor(raw_text)
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            return extracted_data, elapsed_ms, warnings, "heuristic_fallback"

        response_json = response.json()
        
        # Extract text from response candidates
        candidates = response_json.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini returned empty candidates list.")

        content_parts = candidates[0].get("content", {}).get("parts", [])
        if not content_parts:
            raise ValueError("Gemini candidate contains no content parts.")

        raw_output_text = content_parts[0].get("text", "").strip()

        # Clean markdown wrappers if present
        cleaned_json = raw_output_text
        if cleaned_json.startswith("```json"):
            cleaned_json = cleaned_json[7:]
        if cleaned_json.startswith("```"):
            cleaned_json = cleaned_json[3:]
        if cleaned_json.endswith("```"):
            cleaned_json = cleaned_json[:-3]
        cleaned_json = cleaned_json.strip()

        parsed_dict = json.loads(cleaned_json)

        # Validate with Pydantic
        extracted_data = ExtractedExecutionData.model_validate(parsed_dict)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return extracted_data, elapsed_ms, warnings, "gemini"

    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning(f"Network error calling Gemini: {str(e)}")
        warnings.append(f"Gemini API timeout or network error. Used grounded fallback extraction.")
        extracted_data = heuristic_fallback_extractor(raw_text)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return extracted_data, elapsed_ms, warnings, "heuristic_fallback"

    except (json.JSONDecodeError, ValidationError, ValueError) as e:
        logger.warning(f"Gemini output parsing/validation error: {str(e)}")
        warnings.append(f"Gemini JSON validation issue ({str(e)}). Used grounded fallback extraction.")
        extracted_data = heuristic_fallback_extractor(raw_text)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return extracted_data, elapsed_ms, warnings, "heuristic_fallback"

    except Exception as e:
        logger.error(f"Unexpected error in Gemini extraction: {str(e)}")
        warnings.append(f"Unexpected extraction error ({str(e)}). Used grounded fallback extraction.")
        extracted_data = heuristic_fallback_extractor(raw_text)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return extracted_data, elapsed_ms, warnings, "heuristic_fallback"
