# wos-etl-hotspot Agent

Select the Agent : wos-etl-hotspot.agent 

## Required Input

Provide the **source directory** — the root folder of the application source code.

The following files must all be present inside the source directory:

- `.exe` — the application executable
- `.pdb` — the matching symbols file (same build as the `.exe`)
- `.etl` — the ETL scenario trace (must be a real workload capture, not idle or synthetic)

**Example:** `C:\src\myapp`

---

## External Dependencies

### Python 3
- Must be installed and available on `PATH`
- Invoked as `py -3`, `python`, or `python3`
- **Auto-installed** via `winget install Python.Python.3` if not found

### Windows Performance Toolkit
- Part of the **Windows ADK** or **Windows SDK**
- Provides two tools used internally:
  - `symcachegen.exe` — loads symbols from the `.pdb` for function name resolution
  - `wpaexporter.exe` — exports CPU sampling data from the `.etl` trace to CSV
- **Auto-installed** via `winget install Microsoft.WindowsADK` if not found; the Windows Performance Toolkit feature must be selected during install
