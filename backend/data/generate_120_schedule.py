import os
import pandas as pd
from datetime import datetime, timedelta

os.makedirs("backend/data", exist_ok=True)

disciplines = ["Piping", "Civil", "Electrical", "Mechanical", "Instrumentation", "Structural"]
locations = ["Area PR-01", "Area PR-02", "Area PR-03", "Area PR-04", "Compressor Bay 1", "Compressor Bay 2", "Substation Yard", "Flare Yard", "Tank Farm 1", "Switchgear L2"]

activities = []
start_date = datetime(2026, 9, 1)

# Templates per discipline
templates = {
    "Piping": [
        ("Install {size}-inch spool at {loc}", "Process Area Piping", "1.3.4.1", "PR-04", "{size}-XX"),
        ("Hydrotest Line {line}", "Hydrotesting & NDT", "1.3.4.2", "PR-04", "{line}"),
        ("Erect pipe rack supports at {loc}", "Pipe Rack Structural", "1.3.4.3", "PR-02", ""),
        ("Tie-in weld at Flare Header {line}", "Flare Line Tie-ins", "1.3.4.4", "FL-101", "{line}")
    ],
    "Civil": [
        ("Pour Foundation Slab for {asset}", "Equipment Foundations", "1.2.1.1", "{asset}", ""),
        ("Install storm water drainage at {loc}", "Underground Drainage", "1.2.3.2", "", "DRN-500"),
        ("Grouting for Static Vessel Foundations {asset}", "Vessel Foundations", "1.2.1.3", "{asset}", ""),
        ("Erect precast boundary wall at {loc}", "Site Infrastructure", "1.2.4.1", "", "")
    ],
    "Electrical": [
        ("Install Cable Trays at {loc}", "Substation Cable Containment", "1.4.1.2", "{asset}", ""),
        ("Pull HV Power Feeder Cable to {asset}", "High Voltage Cabling", "1.4.2.1", "{asset}", ""),
        ("Terminate Control Cables at {loc}", "Control Cabling", "1.4.2.2", "{asset}", ""),
        ("Energization testing of Transformer {asset}", "Substation Commissioning", "1.4.3.1", "{asset}", "")
    ],
    "Mechanical": [
        ("Erect Main Column {asset} Section", "Major Static Columns", "1.5.1.1", "{asset}", ""),
        ("Align Compressor Drive Shaft {asset}", "Rotating Equipment Alignment", "1.5.2.2", "{asset}", ""),
        ("Install Heat Exchanger {asset}", "Heat Exchangers Erection", "1.5.1.3", "{asset}", ""),
        ("Coupling inspection for Pump {asset}", "Rotating Equipment Commissioning", "1.5.2.4", "{asset}", "")
    ],
    "Instrumentation": [
        ("Mount Pressure Transmitter {asset} at {loc}", "Field Instruments Installation", "1.6.1.1", "{asset}", "24-XX"),
        ("Calibrate Flow Control Valve {asset}", "Control Valves Calibration", "1.6.2.3", "{asset}", "18-YY"),
        ("Loop check temperature sensor {asset}", "Loop Checking", "1.6.3.1", "{asset}", ""),
        ("Hookup DCS Marshalling Cabinet at {loc}", "DCS Marshalling", "1.6.1.4", "DCS-01", "")
    ],
    "Structural": [
        ("Erect secondary steel framing at {loc}", "Structural Framing", "1.7.1.1", "", ""),
        ("Bolt tightening and torque verification at {loc}", "Structural Bolting", "1.7.1.2", "", ""),
        ("Install grating and handrails at {loc}", "Access Platforms", "1.7.2.1", "", ""),
        ("Fireproofing coating application on structural columns at {loc}", "Passive Fireproofing", "1.7.3.1", "", "")
    ]
}

counter = 1
for d_idx, disc in enumerate(disciplines):
    disc_templates = templates[disc]
    for i in range(20):  # 20 activities per discipline = 120 total activities
        tmpl_idx = i % len(disc_templates)
        tmpl, wbs_name, wbs_code, asset_tmpl, line_tmpl = disc_templates[tmpl_idx]
        
        loc = locations[(d_idx * 3 + i) % len(locations)]
        size = [6, 8, 12, 18, 24, 30][i % 6]
        asset = f"{disc[:3].upper()}-{100 + i}" if not asset_tmpl else asset_tmpl.format(asset=f"{disc[:3].upper()}-{100 + i}")
        line = f"{size}-XX" if not line_tmpl else line_tmpl.format(size=size, line=f"{size}-XX")
        
        act_name = tmpl.format(size=size, loc=loc, asset=asset, line=line)
        act_id = f"{disc[:3].upper()}-L5-{counter:03d}"
        
        act_start = start_date + timedelta(days=(counter * 2) % 45)
        act_duration = (i % 8) + 3
        act_finish = act_start + timedelta(days=act_duration)
        planned_pct = [0, 20, 50, 75, 100][(counter + i) % 5]
        
        pred = f"{disc[:3].upper()}-L5-{counter-1:03d}" if i > 0 else ""
        
        activities.append({
            "Activity ID": act_id,
            "Activity Name": act_name,
            "WBS Code": wbs_code,
            "WBS Name": wbs_name,
            "Level": "L5",
            "Discipline": disc,
            "Location": loc,
            "Asset ID": asset,
            "Line ID": line,
            "Planned Start": act_start.strftime("%Y-%m-%d"),
            "Planned Finish": act_finish.strftime("%Y-%m-%d"),
            "Duration": act_duration,
            "Planned %": planned_pct,
            "Predecessors": pred
        })
        counter += 1

df = pd.DataFrame(activities)
df.to_csv("backend/data/schedule_activities_120.csv", index=False)
print(f"Generated backend/data/schedule_activities_120.csv with {len(df)} activities across {len(disciplines)} disciplines.")
