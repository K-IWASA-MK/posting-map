import os
import re

files = [
    "scripts/v2_ui.gs",
    "scripts/v2_extract.gs",
    "scripts/v2_stats.gs",
    "scripts/v2_batch.gs",
    "scripts/v2_map.gs",
    "scripts/v2_api.gs",
    "scripts/v2_eventlog_writer.gs",
    "scripts/migration/system_freeze.gs",
    "scripts/migration/legacy_to_eventlog.gs",
    "scripts/migration/backup_snapshot.gs",
    "scripts/migration/reconciliation_report.gs",
    "scripts/migration/validate_eventlog.gs"
]

def replace_config(match):
    prop = match.group(1)
    if prop in ["STORAGE_PARENT_ID", "get"]:
        return match.group(0) # Do not replace
    return f'CONFIG.get("{prop}")'

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # First replace CONFIG.SHEETS.EVENTLOG
    content = content.replace("CONFIG.SHEETS.EVENTLOG", "CONFIG.get(\"SHEETS.EVENTLOG\")")
    
    # Then replace CONFIG.SOMETHING
    content = re.sub(r'CONFIG\.([A-Z0-9_]+)', replace_config, content)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Done")
