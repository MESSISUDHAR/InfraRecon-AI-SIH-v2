import os
import pandas as pd
from datetime import datetime, timedelta

# Create data folder
os.makedirs("backend/data", exist_ok=True)

# 1. Refinery Expansion L5 Dataset (CSV)
refinery_data = [
    # Piping
    {"Activity ID": "PIP-L5-034", "Activity Name": "Install 24-inch spool at PR-04", "WBS Code": "1.3.4.1", "WBS Name": "Process Area Piping", "Level": "L5", "Discipline": "Piping", "Location": "Area PR-04", "Asset ID": "PR-04", "Line ID": "24-XX", "Planned Start": "2026-09-01", "Planned Finish": "2026-09-08", "Duration": 7, "Planned %": 100, "Predecessors": "CIV-L5-088"},
    {"Activity ID": "HYD-L5-012", "Activity Name": "Hydrotest Line 24-XX", "WBS Code": "1.3.4.2", "WBS Name": "Hydrotesting & NDT", "Level": "L5", "Discipline": "Piping", "Location": "Area PR-04", "Asset ID": "PR-04", "Line ID": "24-XX", "Planned Start": "2026-09-09", "Planned Finish": "2026-09-12", "Duration": 3, "Planned %": 0, "Predecessors": "PIP-L5-034"},
    {"Activity ID": "PIP-L5-031", "Activity Name": "Install 18-inch spool at PR-03", "WBS Code": "1.3.4.1", "WBS Name": "Process Area Piping", "Level": "L5", "Discipline": "Piping", "Location": "Area PR-03", "Asset ID": "PR-03", "Line ID": "18-YY", "Planned Start": "2026-09-03", "Planned Finish": "2026-09-10", "Duration": 7, "Planned %": 80, "Predecessors": ""},
    {"Activity ID": "PIP-L5-032", "Activity Name": "Erect pipe rack supports Area B", "WBS Code": "1.3.4.3", "WBS Name": "Pipe Rack Structural", "Level": "L5", "Discipline": "Piping", "Location": "Rack B", "Asset ID": "PR-02", "Line ID": "", "Planned Start": "2026-08-25", "Planned Finish": "2026-09-02", "Duration": 8, "Planned %": 100, "Predecessors": ""},
    {"Activity ID": "PIP-L5-039", "Activity Name": "Tie-in weld at Flare Header FL-101", "WBS Code": "1.3.4.4", "WBS Name": "Flare Line Tie-ins", "Level": "L5", "Discipline": "Piping", "Location": "Flare Yard", "Asset ID": "FL-101", "Line ID": "FL-01", "Planned Start": "2026-09-10", "Planned Finish": "2026-09-15", "Duration": 5, "Planned %": 0, "Predecessors": "PIP-L5-034"},
    
    # Civil & Structural
    {"Activity ID": "CIV-L5-088", "Activity Name": "Pour Foundation Slab - Compressor Unit B2", "WBS Code": "1.2.1.1", "WBS Name": "Equipment Foundations", "Level": "L5", "Discipline": "Civil", "Location": "Compressor Bay 2", "Asset ID": "CMP-02", "Line ID": "", "Planned Start": "2026-08-20", "Planned Finish": "2026-08-30", "Duration": 10, "Planned %": 100, "Predecessors": ""},
    {"Activity ID": "CIV-L5-092", "Activity Name": "Install 20-inch storm water piping - Area Z3", "WBS Code": "1.2.3.2", "WBS Name": "Underground Drainage", "Level": "L5", "Discipline": "Civil", "Location": "Zone 3", "Asset ID": "", "Line ID": "DRN-500", "Planned Start": "2026-09-01", "Planned Finish": "2026-09-07", "Duration": 6, "Planned %": 100, "Predecessors": ""},
    {"Activity ID": "CIV-L5-095", "Activity Name": "Grouting for Static Vessel Foundations TK-102", "WBS Code": "1.2.1.3", "WBS Name": "Vessel Foundations", "Level": "L5", "Discipline": "Civil", "Location": "Tank Farm 1", "Asset ID": "TK-102", "Line ID": "", "Planned Start": "2026-09-05", "Planned Finish": "2026-09-09", "Duration": 4, "Planned %": 50, "Predecessors": "CIV-L5-088"},
    
    # Electrical
    {"Activity ID": "ELE-L5-104", "Activity Name": "Install Cable Trays - Switchgear Room Level 2", "WBS Code": "1.4.1.2", "WBS Name": "Substation Cable Containment", "Level": "L5", "Discipline": "Electrical", "Location": "Switchgear L2", "Asset ID": "SWG-02", "Line ID": "", "Planned Start": "2026-09-04", "Planned Finish": "2026-09-12", "Duration": 8, "Planned %": 40, "Predecessors": ""},
    {"Activity ID": "ELE-L5-108", "Activity Name": "Install Cable Trays - Control Room Level 2", "WBS Code": "1.4.1.3", "WBS Name": "Control Room Cable Containment", "Level": "L5", "Discipline": "Electrical", "Location": "Control Room L2", "Asset ID": "CTL-02", "Line ID": "", "Planned Start": "2026-09-04", "Planned Finish": "2026-09-12", "Duration": 8, "Planned %": 30, "Predecessors": ""},
    {"Activity ID": "ELE-L5-115", "Activity Name": "Pull HV Power Feeder Cable to Transformer TR-01", "WBS Code": "1.4.2.1", "WBS Name": "High Voltage Cabling", "Level": "L5", "Discipline": "Electrical", "Location": "Substation Yard", "Asset ID": "TR-01", "Line ID": "", "Planned Start": "2026-09-11", "Planned Finish": "2026-09-16", "Duration": 5, "Planned %": 0, "Predecessors": "ELE-L5-104"},

    # Mechanical
    {"Activity ID": "MEC-L5-055", "Activity Name": "Erect Main Fractionator Column C-101 Section A", "WBS Code": "1.5.1.1", "WBS Name": "Major Static Columns", "Level": "L5", "Discipline": "Mechanical", "Location": "Crude Unit 1", "Asset ID": "C-101", "Line ID": "", "Planned Start": "2026-08-15", "Planned Finish": "2026-08-28", "Duration": 13, "Planned %": 100, "Predecessors": ""},
    {"Activity ID": "MEC-L5-060", "Activity Name": "Align Compressor Drive Shaft CMP-02", "WBS Code": "1.5.2.2", "WBS Name": "Rotating Equipment Alignment", "Level": "L5", "Discipline": "Mechanical", "Location": "Compressor Bay 2", "Asset ID": "CMP-02", "Line ID": "", "Planned Start": "2026-09-07", "Planned Finish": "2026-09-11", "Duration": 4, "Planned %": 20, "Predecessors": "CIV-L5-088"},

    # Instrumentation
    {"Activity ID": "INS-L5-201", "Activity Name": "Mount Pressure Transmitter PT-204 at PR-04", "WBS Code": "1.6.1.1", "WBS Name": "Field Instruments Installation", "Level": "L5", "Discipline": "Instrumentation", "Location": "Area PR-04", "Asset ID": "PT-204", "Line ID": "24-XX", "Planned Start": "2026-09-08", "Planned Finish": "2026-09-10", "Duration": 2, "Planned %": 0, "Predecessors": "PIP-L5-034"},
    {"Activity ID": "INS-L5-205", "Activity Name": "Calibrate Flow Control Valve FCV-101", "WBS Code": "1.6.2.3", "WBS Name": "Control Valves Calibration", "Level": "L5", "Discipline": "Instrumentation", "Location": "Area PR-02", "Asset ID": "FCV-101", "Line ID": "18-YY", "Planned Start": "2026-09-06", "Planned Finish": "2026-09-08", "Duration": 2, "Planned %": 50, "Predecessors": ""}
]

df_refinery = pd.DataFrame(refinery_data)
df_refinery.to_csv("backend/data/refinery_expansion_l5.csv", index=False)
print("Saved backend/data/refinery_expansion_l5.csv with", len(df_refinery), "activities.")

# 2. Metro Rail Viaduct L6 Dataset (XLSX)
metro_data = [
    {"Task Code": "METRO-L6-0101", "Task Name": "Cast in-situ Pier Column P-14", "WBS Element": "VIAD.01.PIER", "WBS Description": "Viaduct Substructure", "Tier": "L6", "Trade": "Civil", "Site Section": "Chainage 14+200", "Equipment Tag": "PIER-14", "Line Tag": "", "Start Date": "2026-08-10", "Finish Date": "2026-08-18", "Duration Days": 8, "Pct Complete": 100, "Dependencies": ""},
    {"Task Code": "METRO-L6-0102", "Task Name": "Cast in-situ Pier Column P-15", "WBS Element": "VIAD.01.PIER", "WBS Description": "Viaduct Substructure", "Tier": "L6", "Trade": "Civil", "Site Section": "Chainage 14+250", "Equipment Tag": "PIER-15", "Line Tag": "", "Start Date": "2026-08-15", "Finish Date": "2026-08-23", "Duration Days": 8, "Pct Complete": 100, "Dependencies": ""},
    {"Task Code": "METRO-L6-0201", "Task Name": "Launch U-Girder Span P14-P15", "WBS Element": "VIAD.02.GIRDER", "WBS Description": "Superstructure Erection", "Tier": "L6", "Trade": "Civil", "Site Section": "Span 14-15", "Equipment Tag": "LG-01", "Line Tag": "", "Start Date": "2026-08-25", "Finish Date": "2026-09-02", "Duration Days": 8, "Pct Complete": 100, "Dependencies": "METRO-L6-0101, METRO-L6-0102"},
    {"Task Code": "METRO-L6-0301", "Task Name": "Laying Ballastless Track Plinth Span 14-15", "WBS Element": "TRACK.01.PLINTH", "WBS Description": "Track Infrastructure", "Tier": "L6", "Trade": "Trackwork", "Site Section": "Span 14-15", "Equipment Tag": "PLN-1415", "Line Tag": "UP-TRACK", "Start Date": "2026-09-03", "Finish Date": "2026-09-09", "Duration Days": 6, "Pct Complete": 70, "Dependencies": "METRO-L6-0201"},
    {"Task Code": "METRO-L6-0401", "Task Name": "Erect OHE Traction Mast Span 14-15", "WBS Element": "ELEC.01.OHE", "WBS Description": "Overhead Electrification", "Tier": "L6", "Trade": "Traction Power", "Site Section": "Span 14-15", "Equipment Tag": "MAST-1415", "Line Tag": "25KV-OHE", "Start Date": "2026-09-08", "Finish Date": "2026-09-12", "Duration Days": 4, "Pct Complete": 0, "Dependencies": "METRO-L6-0301"},
    {"Task Code": "METRO-L6-0501", "Task Name": "Install Axle Counter Detection Block B14", "WBS Element": "SIG.01.AXLE", "WBS Description": "Signalling & Train Control", "Tier": "L6", "Trade": "Signalling", "Site Section": "Block B-14", "Equipment Tag": "AXC-14", "Line Tag": "CBTC-01", "Start Date": "2026-09-10", "Finish Date": "2026-09-14", "Duration Days": 4, "Pct Complete": 0, "Dependencies": "METRO-L6-0301"}
]

df_metro = pd.DataFrame(metro_data)
df_metro.to_excel("backend/data/metro_rail_package_l6.xlsx", index=False, engine="openpyxl")
print("Saved backend/data/metro_rail_package_l6.xlsx with", len(df_metro), "activities.")
