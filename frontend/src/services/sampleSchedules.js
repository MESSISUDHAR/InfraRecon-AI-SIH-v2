export const REFINERY_CSV_CONTENT = `Activity ID,Activity Name,WBS Code,WBS Name,Level,Discipline,Location,Asset ID,Line ID,Planned Start,Planned Finish,Duration,Planned %,Predecessors
PIP-L5-034,Install 24-inch spool at PR-04,1.3.4.1,Process Area Piping,L5,Piping,Area PR-04,PR-04,24-XX,2026-09-01,2026-09-08,7,100,CIV-L5-088
HYD-L5-012,Hydrotest Line 24-XX,1.3.4.2,Hydrotesting & NDT,L5,Piping,Area PR-04,PR-04,24-XX,2026-09-09,2026-09-12,3,0,PIP-L5-034
PIP-L5-031,Install 18-inch spool at PR-03,1.3.4.1,Process Area Piping,L5,Piping,Area PR-03,PR-03,18-YY,2026-09-03,2026-09-10,7,80,
PIP-L5-032,Erect pipe rack supports Area B,1.3.4.3,Pipe Rack Structural,L5,Piping,Rack B,PR-02,,2026-08-25,2026-09-02,8,100,
PIP-L5-039,Tie-in weld at Flare Header FL-101,1.3.4.4,Flare Line Tie-ins,L5,Piping,Flare Yard,FL-101,FL-01,2026-09-10,2026-09-15,5,0,PIP-L5-034
CIV-L5-088,Pour Foundation Slab - Compressor Unit B2,1.2.1.1,Equipment Foundations,L5,Civil,Compressor Bay 2,CMP-02,,2026-08-20,2026-08-30,10,100,
CIV-L5-092,Install 20-inch storm water piping - Area Z3,1.2.3.2,Underground Drainage,L5,Civil,Zone 3,,DRN-500,2026-09-01,2026-09-07,6,100,
CIV-L5-095,Grouting for Static Vessel Foundations TK-102,1.2.1.3,Vessel Foundations,L5,Civil,Tank Farm 1,TK-102,,2026-09-05,2026-09-09,4,50,CIV-L5-088
ELE-L5-104,Install Cable Trays - Switchgear Room Level 2,1.4.1.2,Substation Cable Containment,L5,Electrical,Switchgear L2,SWG-02,,2026-09-04,2026-09-12,8,40,
ELE-L5-108,Install Cable Trays - Control Room Level 2,1.4.1.3,Control Room Cable Containment,L5,Electrical,Control Room L2,CTL-02,,2026-09-04,2026-09-12,8,30,
ELE-L5-115,Pull HV Power Feeder Cable to Transformer TR-01,1.4.2.1,High Voltage Cabling,L5,Electrical,Substation Yard,TR-01,,2026-09-11,2026-09-16,5,0,ELE-L5-104
MEC-L5-055,Erect Main Fractionator Column C-101 Section A,1.5.1.1,Major Static Columns,L5,Mechanical,Crude Unit 1,C-101,,2026-08-15,2026-08-28,13,100,
MEC-L5-060,Align Compressor Drive Shaft CMP-02,1.5.2.2,Rotating Equipment Alignment,L5,Mechanical,Compressor Bay 2,CMP-02,,2026-09-07,2026-09-11,4,20,CIV-L5-088
INS-L5-201,Mount Pressure Transmitter PT-204 at PR-04,1.6.1.1,Field Instruments Installation,L5,Instrumentation,Area PR-04,PT-204,24-XX,2026-09-08,2026-09-10,2,0,PIP-L5-034
INS-L5-205,Calibrate Flow Control Valve FCV-101,1.6.2.3,Control Valves Calibration,L5,Instrumentation,Area PR-02,FCV-101,18-YY,2026-09-06,2026-09-08,2,50,`;

export const METRO_CSV_CONTENT = `Task Code,Task Name,WBS Element,WBS Description,Tier,Trade,Site Section,Equipment Tag,Line Tag,Start Date,Finish Date,Duration Days,Pct Complete,Dependencies
METRO-L6-0101,Cast in-situ Pier Column P-14,VIAD.01.PIER,Viaduct Substructure,L6,Civil,Chainage 14+200,PIER-14,,2026-08-10,2026-08-18,8,100,
METRO-L6-0102,Cast in-situ Pier Column P-15,VIAD.01.PIER,Viaduct Substructure,L6,Civil,Chainage 14+250,PIER-15,,2026-08-15,2026-08-23,8,100,
METRO-L6-0201,Launch U-Girder Span P14-P15,VIAD.02.GIRDER,Superstructure Erection,L6,Civil,Span 14-15,LG-01,,2026-08-25,2026-09-02,8,100,"METRO-L6-0101, METRO-L6-0102"
METRO-L6-0301,Laying Ballastless Track Plinth Span 14-15,TRACK.01.PLINTH,Track Infrastructure,L6,Trackwork,Span 14-15,PLN-1415,UP-TRACK,2026-09-03,2026-09-09,6,70,METRO-L6-0201
METRO-L6-0401,Erect OHE Traction Mast Span 14-15,ELEC.01.OHE,Overhead Electrification,L6,Traction Power,Span 14-15,MAST-1415,25KV-OHE,2026-09-08,2026-09-12,4,0,METRO-L6-0301
METRO-L6-0501,Install Axle Counter Detection Block B14,SIG.01.AXLE,Signalling & Train Control,L6,Signalling,Block B-14,AXC-14,CBTC-01,2026-09-10,2026-09-14,4,0,METRO-L6-0301`;
