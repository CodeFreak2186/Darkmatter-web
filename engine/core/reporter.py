"""
reporter.py — Reporting engine.
Generates JSON and HTML reports with PoCs, CVSS, remediation.
"""

from __future__ import annotations
import json
import time
from pathlib import Path
from dataclasses import asdict
from typing import Any

from core.detector import Detection
from core.crawler import AttackSurface


class Reporter:
    """Generates vulnerability reports in JSON and HTML."""

    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

    def generate(
        self,
        target: str,
        detections: list[Detection],
        surface: AttackSurface | None = None,
        scan_time: float = 0,
        mode: str = "fuzz",
    ) -> dict[str, str]:
        """Generate all report formats. Returns dict of format -> file path."""
        timestamp = int(time.time())
        domain = target.replace("https://", "").replace("http://", "").split("/")[0]
        base_name = f"{domain}_{timestamp}"

        report_data = self._build_report_data(target, detections, surface, scan_time, mode)

        paths = {}
        paths["json"] = self._write_json(base_name, report_data)
        paths["html"] = self._write_html(base_name, report_data)
        return paths

    def _build_report_data(
        self,
        target: str,
        detections: list[Detection],
        surface: AttackSurface | None,
        scan_time: float,
        mode: str,
    ) -> dict[str, Any]:
        crit = sum(1 for d in detections if d.severity == "critical")
        high = sum(1 for d in detections if d.severity == "high")
        med = sum(1 for d in detections if d.severity == "medium")
        low = sum(1 for d in detections if d.severity == "low")
        info = sum(1 for d in detections if d.severity == "info")
        risk = min(10, round(crit * 2.5 + high * 1.5 + med * 0.7 + low * 0.2, 1))

        return {
            "meta": {
                "tool": "DARKMATTER Fuzzing Framework v3.0",
                "target": target,
                "scan_time_seconds": round(scan_time, 1),
                "mode": mode,
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
            "summary": {
                "risk_score": risk,
                "total_findings": len(detections),
                "critical": crit, "high": high, "medium": med, "low": low, "info": info,
                "endpoints_tested": len(surface.endpoints) if surface else 0,
                "technologies": surface.technologies if surface else [],
            },
            "findings": [
                {
                    "id": i + 1,
                    "vector": d.vector.value,
                    "severity": d.severity,
                    "confidence": round(d.confidence, 2),
                    "title": d.description,
                    "endpoint": d.endpoint,
                    "method": d.method,
                    "parameter": d.param_name,
                    "payload": d.payload,
                    "evidence": d.evidence,
                    "category": d.category,
                    "cvss": d.cvss,
                    "recommendation": d.recommendation,
                    "poc": d.poc,
                    "false_positive_risk": d.false_positive_risk,
                }
                for i, d in enumerate(detections)
            ],
            "attack_surface": {
                "endpoints": len(surface.endpoints) if surface else 0,
                "js_files": len(surface.js_files) if surface else 0,
                "api_paths": surface.api_paths if surface else [],
                "technologies": surface.technologies if surface else [],
                "cookies": surface.cookies if surface else {},
            } if surface else None,
        }

    def _write_json(self, base_name: str, data: dict) -> str:
        path = self.output_dir / f"{base_name}.json"
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return str(path)

    def _write_html(self, base_name: str, data: dict) -> str:
        """Generate a professional HTML report."""
        findings = data["findings"]
        summary = data["summary"]
        meta = data["meta"]

        sev_colors = {
            "critical": "#dc2626", "high": "#ea580c",
            "medium": "#ca8a04", "low": "#2563eb", "info": "#6b7280",
        }

        findings_html = ""
        for f in findings:
            color = sev_colors.get(f["severity"], "#6b7280")
            findings_html += f"""
            <div class="finding" style="border-left: 4px solid {color}; padding: 16px; margin: 12px 0; background: #1a1a2e; border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:{color}; font-size:12px; text-transform:uppercase; letter-spacing:1px;">
                        [{f['severity']}] {f['vector']}
                    </strong>
                    <span style="color:#666; font-size:11px;">CVSS {f['cvss']}</span>
                </div>
                <h3 style="margin:8px 0 4px; color:#e0e0e0;">{f['title']}</h3>
                <p style="color:#999; font-size:13px; margin:4px 0;">
                    <strong>Endpoint:</strong> {f['method']} {f['endpoint']}<br>
                    <strong>Parameter:</strong> {f['parameter']}<br>
                    <strong>Evidence:</strong> {f['evidence']}<br>
                    <strong>Confidence:</strong> {f['confidence']*100:.0f}%
                </p>
                <div style="background:#0d1117; padding:8px 12px; border-radius:4px; margin:8px 0;">
                    <code style="color:#4af626; font-size:12px;">{f['payload']}</code>
                </div>
                <p style="color:#aaa; font-size:12px; margin:4px 0;">
                    <strong>Recommendation:</strong> {f['recommendation']}
                </p>
                {"<p style='color:#666; font-size:11px;'><strong>PoC:</strong> <code>" + f['poc'] + "</code></p>" if f.get('poc') else ""}
            </div>"""

        html = f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DARKMATTER Security Report — {meta['target']}</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family: 'Segoe UI', system-ui, sans-serif; background:#0a0a1a; color:#e0e0e0; }}
.container {{ max-width:900px; margin:0 auto; padding:40px 20px; }}
h1 {{ color:#4af626; font-size:28px; margin-bottom:8px; }}
h2 {{ color:#4af626; font-size:18px; margin:32px 0 16px; border-bottom:1px solid #333; padding-bottom:8px; }}
.meta {{ color:#888; font-size:13px; margin-bottom:32px; }}
.stats {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:12px; margin:20px 0; }}
.stat {{ background:#1a1a2e; padding:16px; border-radius:8px; text-align:center; }}
.stat-value {{ font-size:28px; font-weight:bold; }}
.stat-label {{ font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px; margin-top:4px; }}
code {{ font-family: 'Fira Code', monospace; }}
</style></head><body>
<div class="container">
    <h1>🔒 DARKMATTER Security Report</h1>
    <p class="meta">
        Target: {meta['target']} &nbsp;|&nbsp; Mode: {meta['mode']} &nbsp;|&nbsp;
        Time: {meta['scan_time_seconds']}s &nbsp;|&nbsp; {meta['generated_at']}
    </p>

    <div class="stats">
        <div class="stat">
            <div class="stat-value" style="color:{'#dc2626' if summary['risk_score'] >= 7 else '#ca8a04' if summary['risk_score'] >= 4 else '#22c55e'}">
                {summary['risk_score']}/10
            </div>
            <div class="stat-label">Risk Score</div>
        </div>
        <div class="stat"><div class="stat-value">{summary['total_findings']}</div><div class="stat-label">Findings</div></div>
        <div class="stat"><div class="stat-value" style="color:#dc2626">{summary['critical']}</div><div class="stat-label">Critical</div></div>
        <div class="stat"><div class="stat-value" style="color:#ea580c">{summary['high']}</div><div class="stat-label">High</div></div>
        <div class="stat"><div class="stat-value" style="color:#ca8a04">{summary['medium']}</div><div class="stat-label">Medium</div></div>
        <div class="stat"><div class="stat-value" style="color:#2563eb">{summary['low']}</div><div class="stat-label">Low</div></div>
    </div>

    <h2>Findings</h2>
    {findings_html if findings_html else '<p style="color:#666;">No vulnerabilities detected.</p>'}

    <h2>Scan Details</h2>
    <div style="background:#1a1a2e; padding:16px; border-radius:8px; font-size:13px; color:#999;">
        <p>Endpoints tested: {summary['endpoints_tested']}</p>
        <p>Technologies: {', '.join(summary.get('technologies', [])) or 'N/A'}</p>
    </div>

    <p style="text-align:center; color:#444; margin-top:40px; font-size:11px;">
        Generated by DARKMATTER Fuzzing Framework v3.0
    </p>
</div></body></html>"""

        path = self.output_dir / f"{base_name}.html"
        path.write_text(html, encoding="utf-8")
        return str(path)
