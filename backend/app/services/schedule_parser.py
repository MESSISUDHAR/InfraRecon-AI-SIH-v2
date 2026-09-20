import io
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import pandas as pd
import numpy as np

# Column aliases for fuzzy matching
COLUMN_ALIASES: Dict[str, List[str]] = {
    "activity_id": [
        "activity_id", "activity id", "act_id", "act id", "activity_code", "activity code", 
        "task_id", "task id", "task_code", "task code", "code", "id", "activity"
    ],
    "activity_name": [
        "activity_name", "activity name", "activity_description", "activity description", 
        "task_name", "task name", "task_description", "task description", "description", 
        "name", "title", "activity name / description"
    ],
    "wbs_code": [
        "wbs_code", "wbs code", "wbs", "wbs_id", "wbs id", "wbs element", "wbs_element"
    ],
    "wbs_name": [
        "wbs_name", "wbs name", "wbs_description", "wbs description", "wbs title"
    ],
    "level": [
        "level", "wbs_level", "wbs level", "activity_level", "activity level", "tier", "schedule_level"
    ],
    "discipline": [
        "discipline", "trade", "department", "disc", "sector", "package", "work_package"
    ],
    "location": [
        "location", "area", "zone", "workfront", "plant_area", "plant area", "unit", "block", "site", "section"
    ],
    "asset_id": [
        "asset_id", "asset id", "asset_tag", "asset tag", "equipment_tag", "equipment tag", 
        "equipment id", "equipment_id", "asset", "equipment", "tag_no", "tag"
    ],
    "line_id": [
        "line_id", "line id", "line_no", "line no", "line_number", "line number", 
        "spool_id", "spool id", "spool_no", "spool no", "line", "piping_line"
    ],
    "planned_start": [
        "planned_start", "planned start", "start_date", "start date", "start", 
        "early_start", "early start", "baseline_start", "baseline start", "target_start"
    ],
    "planned_finish": [
        "planned_finish", "planned finish", "finish_date", "finish date", "finish", 
        "end_date", "end date", "end", "early_finish", "early finish", "baseline_finish", "baseline finish", "target_finish"
    ],
    "planned_duration": [
        "planned_duration", "planned duration", "duration", "duration_days", "duration days", 
        "days", "planned_days", "planned days"
    ],
    "planned_progress": [
        "planned_progress", "planned progress", "planned_%", "planned percent", 
        "progress", "baseline_progress", "pct_complete", "% complete"
    ],
    "predecessor_ids": [
        "predecessor_ids", "predecessor ids", "predecessors", "predecessor", 
        "pred", "dependencies", "predecessor_activity_ids", "predecessor activity ids"
    ]
}

def clean_column_name(col: str) -> str:
    """Normalize column name: lowercase, trim, remove special characters."""
    col = str(col).strip().lower()
    col = re.sub(r'[\s_]+', ' ', col)
    return col

def detect_column_mappings(df_columns: List[str]) -> Dict[str, str]:
    """Map DataFrame raw columns to standardized schedule schema fields."""
    normalized_to_raw = {}
    cleaned_raw_cols = {clean_column_name(col): col for col in df_columns}
    
    for standard_field, aliases in COLUMN_ALIASES.items():
        matched_raw = None
        for alias in aliases:
            clean_alias = clean_column_name(alias)
            if clean_alias in cleaned_raw_cols:
                matched_raw = cleaned_raw_cols[clean_alias]
                break
        
        # If no exact alias match, try substring match
        if not matched_raw:
            for clean_raw, raw_col in cleaned_raw_cols.items():
                for alias in aliases:
                    clean_alias = clean_column_name(alias)
                    if clean_alias == clean_raw or (len(clean_alias) > 3 and clean_alias in clean_raw):
                        matched_raw = raw_col
                        break
                if matched_raw:
                    break
                    
        if matched_raw:
            normalized_to_raw[standard_field] = matched_raw
            
    return normalized_to_raw

def parse_date(value: Any) -> Optional[datetime]:
    """Robust date parsing for various date formats and Excel serial dates."""
    if value is None or pd.isna(value) or str(value).strip() == "" or str(value).strip().lower() in ["nan", "null", "none", "n/a"]:
        return None
    
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.to_pydatetime() if hasattr(value, "to_pydatetime") else value
        
    val_str = str(value).strip()
    
    # Common date formats in engineering schedules
    formats = [
        "%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%m-%d-%Y",
        "%d-%b-%Y", "%d-%b-%y", "%d %b %Y", "%d %B %Y",
        "%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            continue
            
    try:
        dt = pd.to_datetime(val_str, errors='coerce')
        if not pd.isna(dt):
            return dt.to_pydatetime()
    except Exception:
        pass
        
    return None

def build_searchable_text(
    activity_name: str,
    discipline: Optional[str] = None,
    location: Optional[str] = None,
    asset_id: Optional[str] = None,
    line_id: Optional[str] = None,
    wbs_name: Optional[str] = None,
    wbs_code: Optional[str] = None,
    activity_id: Optional[str] = None
) -> str:
    """
    Builds a rich, normalized, context-preserving searchable text representation
    for embedding and semantic similarity matching.
    """
    parts = [f"Activity: {activity_name.strip()}"]
    
    if activity_id:
        parts.append(f"Code: {activity_id.strip()}")
    if discipline and discipline.strip() and discipline.strip().lower() != "nan":
        parts.append(f"Discipline: {discipline.strip()}")
    if location and location.strip() and location.strip().lower() != "nan":
        parts.append(f"Location: {location.strip()}")
    if asset_id and asset_id.strip() and asset_id.strip().lower() != "nan":
        parts.append(f"Asset: {asset_id.strip()}")
    if line_id and line_id.strip() and line_id.strip().lower() != "nan":
        parts.append(f"Line: {line_id.strip()}")
    if wbs_name and wbs_name.strip() and wbs_name.strip().lower() != "nan":
        parts.append(f"WBS: {wbs_name.strip()}")
    elif wbs_code and wbs_code.strip() and wbs_code.strip().lower() != "nan":
        parts.append(f"WBS Code: {wbs_code.strip()}")
        
    return " | ".join(parts)

def parse_schedule_file(
    file_bytes: bytes,
    filename: str,
    project_id: str = "PRJ-DEFAULT",
    schedule_version: str = "v1.0"
) -> Dict[str, Any]:
    """
    Dynamically parses, normalizes, validates, and prepares schedule activities from CSV or XLSX.
    """
    errors: List[str] = []
    warnings: List[str] = []
    
    filename_lower = filename.lower()
    df: Optional[pd.DataFrame] = None
    
    # 1. Read file with Pandas / OpenPyXL
    try:
        if filename_lower.endswith(".csv") or filename_lower.endswith(".txt"):
            for encoding in ["utf-8", "latin1", "cp1252", "utf-8-sig"]:
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if df is None:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8", errors="replace")
        elif filename_lower.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
        else:
            return {
                "success": False,
                "status": "FAILED",
                "error": f"Unsupported file format '{filename}'. Please upload a valid .csv or .xlsx file.",
                "activities": [],
                "summary": {}
            }
    except Exception as e:
        return {
            "success": False,
            "status": "FAILED",
            "error": f"Failed to read file: {str(e)}",
            "activities": [],
            "summary": {}
        }
        
    if df is None or df.empty:
        return {
            "success": False,
            "status": "FAILED",
            "error": "The uploaded schedule file is empty.",
            "activities": [],
            "summary": {}
        }

    # 2. Detect column mappings dynamically
    col_mapping = detect_column_mappings(list(df.columns))
    
    # Validate Mandatory Columns
    missing_mandatory = []
    if "activity_id" not in col_mapping:
        missing_mandatory.append("Activity ID / Code")
    if "activity_name" not in col_mapping:
        missing_mandatory.append("Activity Name / Description")
        
    if missing_mandatory:
        detected_cols_str = ", ".join([f"'{c}'" for c in df.columns[:8]])
        return {
            "success": False,
            "status": "FAILED",
            "error": f"Missing mandatory schedule column(s): {', '.join(missing_mandatory)}. Detected headers: [{detected_cols_str}].",
            "column_mapping": col_mapping,
            "activities": [],
            "summary": {}
        }

    # 3. Process and normalize row by row
    activities: List[Dict[str, Any]] = []
    disciplines_count: Dict[str, int] = {}
    seen_ids = set()
    
    for row_idx, row in df.iterrows():
        excel_row_num = row_idx + 2  # 1-indexed + header
        
        # Raw value extraction with fallback
        raw_act_id = row.get(col_mapping.get("activity_id"))
        raw_act_name = row.get(col_mapping.get("activity_name"))
        
        # Check mandatory values
        if pd.isna(raw_act_id) or str(raw_act_id).strip() == "":
            warnings.append(f"Row {excel_row_num}: Skipped due to missing Activity ID.")
            continue
            
        if pd.isna(raw_act_name) or str(raw_act_name).strip() == "":
            warnings.append(f"Row {excel_row_num}: Skipped due to missing Activity Name.")
            continue
            
        act_id = str(raw_act_id).strip()
        act_name = str(raw_act_name).strip()
        
        # Handle duplicate activity IDs within same schedule
        if act_id in seen_ids:
            warnings.append(f"Row {excel_row_num}: Duplicate Activity ID '{act_id}' detected. Updating with latest definition.")
        seen_ids.add(act_id)
        
        # Optional fields normalization
        wbs_code = str(row.get(col_mapping.get("wbs_code"))).strip() if "wbs_code" in col_mapping and not pd.isna(row.get(col_mapping.get("wbs_code"))) else None
        wbs_name = str(row.get(col_mapping.get("wbs_name"))).strip() if "wbs_name" in col_mapping and not pd.isna(row.get(col_mapping.get("wbs_name"))) else None
        level = str(row.get(col_mapping.get("level"))).strip().upper() if "level" in col_mapping and not pd.isna(row.get(col_mapping.get("level"))) else "L5"
        discipline = str(row.get(col_mapping.get("discipline"))).strip() if "discipline" in col_mapping and not pd.isna(row.get(col_mapping.get("discipline"))) else "General"
        location = str(row.get(col_mapping.get("location"))).strip() if "location" in col_mapping and not pd.isna(row.get(col_mapping.get("location"))) else None
        asset_id = str(row.get(col_mapping.get("asset_id"))).strip() if "asset_id" in col_mapping and not pd.isna(row.get(col_mapping.get("asset_id"))) else None
        line_id = str(row.get(col_mapping.get("line_id"))).strip() if "line_id" in col_mapping and not pd.isna(row.get(col_mapping.get("line_id"))) else None
        predecessor_ids = str(row.get(col_mapping.get("predecessor_ids"))).strip() if "predecessor_ids" in col_mapping and not pd.isna(row.get(col_mapping.get("predecessor_ids"))) else None

        # Clean 'nan' string artifacts
        if discipline and discipline.lower() in ["nan", "null", "none", ""]:
            discipline = "General"
        if location and location.lower() in ["nan", "null", "none", ""]:
            location = None
        if asset_id and asset_id.lower() in ["nan", "null", "none", ""]:
            asset_id = None
        if line_id and line_id.lower() in ["nan", "null", "none", ""]:
            line_id = None
        if predecessor_ids and predecessor_ids.lower() in ["nan", "null", "none", ""]:
            predecessor_ids = None

        # Dates & numbers
        planned_start = parse_date(row.get(col_mapping.get("planned_start"))) if "planned_start" in col_mapping else None
        planned_finish = parse_date(row.get(col_mapping.get("planned_finish"))) if "planned_finish" in col_mapping else None
        
        # Duration calculation or parse
        planned_duration = None
        if "planned_duration" in col_mapping and not pd.isna(row.get(col_mapping.get("planned_duration"))):
            try:
                planned_duration = float(row.get(col_mapping.get("planned_duration")))
            except (ValueError, TypeError):
                pass
        elif planned_start and planned_finish:
            planned_duration = max(1.0, float((planned_finish - planned_start).days))

        # Planned progress
        planned_progress = 0.0
        if "planned_progress" in col_mapping and not pd.isna(row.get(col_mapping.get("planned_progress"))):
            try:
                raw_prog = float(row.get(col_mapping.get("planned_progress")))
                planned_progress = raw_prog if raw_prog <= 100.0 else 100.0
                if raw_prog <= 1.0 and raw_prog > 0:  # If in 0.0 - 1.0 decimal format, convert to 0-100%
                    planned_progress = raw_prog * 100.0
            except (ValueError, TypeError):
                planned_progress = 0.0

        # Build Rich Searchable Text
        searchable_text = build_searchable_text(
            activity_name=act_name,
            discipline=discipline,
            location=location,
            asset_id=asset_id,
            line_id=line_id,
            wbs_name=wbs_name,
            wbs_code=wbs_code,
            activity_id=act_id
        )

        # Track discipline statistics
        disciplines_count[discipline] = disciplines_count.get(discipline, 0) + 1

        record = {
            "id": f"{project_id}_{schedule_version}_{act_id}",
            "project_id": project_id,
            "schedule_version": schedule_version,
            "wbs_code": wbs_code,
            "wbs_name": wbs_name,
            "level": level,
            "activity_id": act_id,
            "activity_code": act_id,
            "activity_name": act_name,
            "discipline": discipline,
            "location": location,
            "asset_id": asset_id,
            "line_id": line_id,
            "planned_start": planned_start,
            "planned_finish": planned_finish,
            "planned_duration": planned_duration,
            "planned_progress": planned_progress,
            "predecessor_ids": predecessor_ids,
            "searchable_text": searchable_text,
            "embedding": None,
            "embedding_json": None
        }
        activities.append(record)

    if not activities:
        return {
            "success": False,
            "status": "FAILED",
            "error": "No valid schedule activities found after processing.",
            "warnings": warnings,
            "activities": [],
            "summary": {}
        }

    # Milestone 5: Dynamically batch generate SentenceTransformers embeddings for all activities
    try:
        import json
        import gc
        from app.services.embedding_service import generate_embeddings_batch
        searchable_texts = [a["searchable_text"] for a in activities]
        embeddings = generate_embeddings_batch(searchable_texts, chunk_size=16)
        for act, emb in zip(activities, embeddings):
            act["embedding"] = emb
            act["embedding_json"] = json.dumps(emb)
        del searchable_texts
        del embeddings
        gc.collect()
    except Exception as e:
        warnings.append(f"Embedding generation warning: {str(e)}")


    summary = {
        "filename": filename,
        "project_id": project_id,
        "schedule_version": schedule_version,
        "total_activities": len(activities),
        "disciplines": disciplines_count,
        "detected_columns": col_mapping,
        "warnings_count": len(warnings),
        "validation_status": "VALIDATED"
    }

    return {
        "success": True,
        "status": "VALIDATED",
        "error": None,
        "warnings": warnings[:10],  # Return top 10 warnings
        "activities": activities,
        "summary": summary
    }
