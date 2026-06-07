"""
CEVA Logistics — single PDF field workbook (ACS PM / closeout).

All 12 forms in one print-friendly PDF with tall rows for pen-and-ink notes.

Requires: pip install reportlab

Run: python scripts/generate_ceva_pm_forms_pdf.py

Output: ./CEVA_Closeout_Field_Workbook_QIS.pdf
"""

from __future__ import annotations

from pathlib import Path

try:
    from reportlab.lib import colors
    from reportlab.lib.colors import HexColor
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )
except ImportError as e:
    raise SystemExit("Install: pip install reportlab\n" + str(e)) from e

ROOT = Path(__file__).resolve().parent.parent
OUT_PDF = ROOT / "CEVA_Closeout_Field_Workbook_QIS.pdf"

NAVY = HexColor("#1B3A5F")

ROW_H_WRITABLE = 0.42 * inch
ROW_H_SMALL = 0.32 * inch


def styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "brand": ParagraphStyle(
            name="brand",
            parent=base["Normal"],
            fontSize=11,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=2,
            fontName="Helvetica-Bold",
        ),
        "ftitle": ParagraphStyle(
            name="ftitle",
            parent=base["Heading1"],
            fontSize=15,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceBefore=6,
            spaceAfter=6,
            fontName="Helvetica-Bold",
        ),
        "fmeta": ParagraphStyle(
            name="fmeta",
            parent=base["Normal"],
            fontSize=10,
            textColor=colors.grey,
            alignment=TA_CENTER,
            fontName="Helvetica-Oblique",
            spaceAfter=10,
        ),
        "intro": ParagraphStyle(
            name="intro",
            parent=base["Normal"],
            fontSize=9,
            textColor=colors.grey,
            fontName="Helvetica-Oblique",
            spaceAfter=10,
            alignment=TA_LEFT,
        ),


def hdr_fill() -> TableStyle:
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
    )


def site_meta_table(sw: dict) -> list:
    data = [
        ["Site ID:", ""],
        ["Facility / address:", ""],
        ["CEVA Security Technology contact:", ""],
        ["QIS lead / superintendent:", ""],
        ["Form date:", ""],
    ]
    tbl = Table(data, colWidths=[2.05 * inch, 4.7 * inch], rowHeights=[ROW_H_SMALL] * 5)
    ts = TableStyle(
        [
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]
    )
    tbl.setStyle(ts)
    return [tbl, Spacer(1, 0.15 * inch)]


def sign_block(sw: dict, roles: tuple[str, ...]) -> list:
    data = [["Role", "Print name", "Signature", "Date"]]
    for r in roles:
        data.append([r, "", "", ""])
    tw = LETTER[0] - 1.2 * inch  # pts
    role_w = 1.42 * inch
    date_w = 1.5 * inch
    mid_share = tw - role_w - date_w
    name_w = max(mid_share / 2, 72)
    tbl = Table(
        data,
        colWidths=[role_w, name_w, name_w, date_w],
        rowHeights=[0.38 * inch] + [ROW_H_WRITABLE] * len(roles),
    )
    ts = hdr_fill()
    ts.add("FONTNAME", (0, 1), (-1, -1), "Helvetica")
    ts.add("FONTSIZE", (0, 1), (-1, -1), 9)
    ts.add("TEXTCOLOR", (0, 1), (-1, -1), colors.black)
    ts.add("BOX", (0, 0), (-1, -1), 0.5, colors.grey)
    ts.add("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey)
    ts.add("ALIGN", (0, 1), (0, -1), "LEFT")
    ts.add("LEFTPADDING", (0, 0), (-1, -1), 6)
    tbl.setStyle(ts)
    return [Spacer(1, 0.08 * inch), tbl]


def blank_grid(headers: list[str], col_widths: list[float], nrows: int) -> Table:
    data = [headers] + [["" for _ in headers] for _ in range(nrows)]
    row_h = [0.42 * inch] + [ROW_H_WRITABLE] * nrows
    tbl = Table(data, colWidths=col_widths, rowHeights=row_h)
    ts = hdr_fill()
    ts.add("FONTNAME", (0, 1), (-1, -1), "Helvetica")
    ts.add("FONTSIZE", (0, 1), (-1, -1), 9)
    ts.add("TEXTCOLOR", (0, 1), (-1, -1), colors.black)
    ts.add("BOX", (0, 0), (-1, -1), 0.5, colors.grey)
    ts.add("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey)
    tbl.setStyle(ts)
    return tbl


def form_header(sw: dict, num: str, title: str, phase: str) -> list:
    return [
        Paragraph("QUALITY INSTALLATION SYSTEMS", sw["brand"]),
        Paragraph(f"Form {num} — <b>{title}</b>", sw["ftitle"]),
        Paragraph(
            "CEVA Logistics — ACS Pro-Watch to Avigilon ACM + Mercury &nbsp;&nbsp;&nbsp; "
            f"<i>Phase: {phase}</i>",
            sw["fmeta"],
        ),
    ]


def build_story() -> list:
    sw = styles()
    story: list = []
    tw = LETTER[0] - 1.2 * inch

    # --- Form 01
    story += form_header(sw, "01", "Site Mobilization &amp; Pre-Job Checklist", "A — Pre-mobilization")
    story += site_meta_table(sw)
    story.append(
        Paragraph(
            "<i>Use before cut-critical work; attach confirmations or ticket IDs in margins.</i>", sw["intro"]
        )
    )
    bullets_01 = [
        "EH&amp;S / induction + visitor checklist",
        "CEVA badges / gate list finalized",
        "MDF-IDF electrical: confirm 120 VAC labeling within ~10 ft of enclosure",
        "Lift reservation + certs on file",
        "Credential workbook — <b>HOLD PO until written CEVA release</b>",
        "Receiving log opened — BOM compare on panels / readers",
        "<b>Form 09</b>: Network Support IP worksheet status (requested/received)",
    ]
    for b in bullets_01:
        story.append(Paragraph("&#8226;&nbsp;" + b, sw["body"]))
    hdr = ["#", "Shipment/pallet ID", "SKU/description", "Qty", "Variance note"]
    story.append(Spacer(1, 0.1 * inch))
    story.append(blank_grid(hdr, [tw * 0.07, tw * 0.27, tw * 0.4, tw * 0.13, tw * 0.13], 10))
    story += sign_block(
        sw, ("QIS site lead", "CEVA facility", "Security Technology witness (optional)")
    )
    story.append(PageBreak())

    # --- Form 02
    story += form_header(sw, "02", "Pro-Watch Decommission Log", "B — Decommission")
    story += site_meta_table(sw)
    story.append(
        Paragraph(
            "<i>Rip/remove per CEVA full replacement standard (log underground conductors slated for abandonment).</i>",
            sw["intro"],
        )
    )
    h2 = ["#", "Legacy panel/loc.", "Cards out", "Tag color", "Ft recovered", "Disposition", "Photo Y/N"]
    story.append(blank_grid(h2, [0.34 * inch] + [(tw - 0.34 * inch) / (len(h2) - 1)] * (len(h2) - 1), 14))
    story.append(Spacer(1, 0.12 * inch))
    story.append(
        Paragraph("<b>Pull / abandonment detail</b> (additional rows if needed attach sheet)", sw["body"])
    )
    h2b = ["Run ID", "From / To", "Removed / abandon / splice", "Verifier"]
    story.append(blank_grid(h2b, [tw * 0.22, tw * 0.4, tw * 0.3, tw * 0.08], 7))
    story += sign_block(sw, ("Lead tech", "Superintendent"))

    story.append(PageBreak())

    # --- Form 03
    story += form_header(sw, "03", "Rough-In &amp; Cable Pull Record", "C — Rough-in")
    story += site_meta_table(sw)
    story.append(
        Paragraph(
            "<i>Yellow plenum composite; yellow 22/6 SHLD CI/CO. Homerun allowance 10 ft loop at reader. "
            "Mark <b>P/F</b> for 500-ft rule unless Form 10 IDF approved.</i>",
            sw["intro"],
        )
    )
    h3 = ["#", "Door", "Reader ID", "Type", "From", "To", "Billed ft", "500 P/F", "Sweep", "Label", "Notes"]
    story.append(blank_grid(h3, [tw / len(h3)] * len(h3), 22))
    story += sign_block(sw, ("Lead pull", "QC / foreman"))

    story.append(PageBreak())

    # --- Form 04
    story += form_header(sw, "04", "Headend Commissioning Record", "D / F — Panel power / checkout")
    story += site_meta_table(sw)
    story.append(
        Paragraph(
            "<i>LSP dual-voltage assemblies; mercury LP1502 + MR52. Log static IP worksheet fields.</i>", sw["intro"]
        )
    )
    h4 = [
        "Cluster",
        "LSP tag",
        "LP1502 S/N",
        "MR52",
        "12V",
        "24V",
        "Breaker",
        "GND",
        "Link",
        "IP",
        "GW/DNS",
        "Notes",
    ]
    story.append(blank_grid(h4, [tw / len(h4)] * len(h4), 12))

    story += sign_block(sw, ("Lead panel tech", "QIS PM"))
    story.append(PageBreak())

    # --- Form 05
    story += form_header(sw, "05", "Device Installation &amp; Termination Sign-Off", "E — Device install")
    story += site_meta_table(sw)
    h5 = [
        "Door",
        "Name",
        "Reader",
        "REX",
        "DPS",
        "Strike/act",
        "Sounder",
        "Dress QC",
        "Photo",
        "ACM map",
        "SAT-ready",
        "Notes",
    ]
    story.append(blank_grid(h5, [tw / len(h5)] * len(h5), 28))

    story += sign_block(sw, ("Installer", "QC", "Witness (facilities opt.)"))
    story.append(PageBreak())

    # --- Form 06
    story += form_header(sw, "06", "ACM Programming Record", "G — Programming")
    story += site_meta_table(sw)
    story.append(
        Paragraph(
            "<i>Controllers per Network worksheet; ACM browser UI only; failover dual-server licensing with CEVA "
            "&quot;doubled-license&quot; guidance — attach distributor excerpt.</i>",
            sw["intro"],
        )
    )
    h6 = ["Controller ID", "IP", "Mask", "Gateway", "DNS1", "DNS2", "Doors qty", "License ref"]
    story.append(blank_grid(h6, [tw / len(h6)] * len(h6), 8))
    story.append(Spacer(1, 0.08 * inch))
    story.append(Paragraph("<b>Door naming (CEVA workbook)</b>", sw["body"]))
    h6b = ["Door #", "System name", "IN reader", "OUT reader", "APB seg.", "Schedule ref"]
    wc = tw / len(h6b)
    story.append(blank_grid(h6b, [wc] * len(h6b), 26))
    story.append(Spacer(1, 0.06 * inch))
    story.append(Paragraph("<b>VPN issuance for CEVA remote support</b> (6 mo typical / document max policy)", sw["body"]))
    story.append(
        Table(
            [
                ["VPN ID / credential", ""],
                ["Issue date", ""],
                ["Expiry date", ""],
            ],
            colWidths=[3.05 * inch, tw - 3.05 * inch],
            rowHeights=[ROW_H_WRITABLE - 4] * 3,
            style=TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ]
            ),
        )
    )

    story += sign_block(sw, ("Programmer lead",))
    story.append(PageBreak())

    # --- Form 07
    story += form_header(sw, "07", "System Acceptance Test (SAT)", "H — Commissioning")
    story += site_meta_table(sw)
    h7 = [
        "Door",
        "IN",
        "OUT",
        "Force",
        "REX",
        "Strike monitor",
        "Alarm",
        "Evidence",
        "Punch notes",
    ]
    story.append(blank_grid(h7, [tw / len(h7)] * len(h7), 30))
    story.append(Spacer(1, 0.06 * inch))
    story.append(Paragraph("<b>CEVA final acceptance</b>", sw["body"]))
    fa = Table(
        [
            ["Print name:", ""],
            ["Title:", ""],
            ["Signature:", ""],
            ["Date:", ""],
        ],
        colWidths=[1.95 * inch, tw - 1.95 * inch],
        rowHeights=[ROW_H_WRITABLE] * 4,
        style=TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
            ]
        ),
    )
    story.append(fa)

    story += sign_block(sw, ("QIS commissioning lead",))

    story.append(PageBreak())

    # --- Form 08
    story += form_header(sw, "08", "Closeout &amp; Turnover Package Checklist", "I — Closeout")
    story += site_meta_table(sw)
    checklist = (
        "As-builts (&amp; CEVA-property deliverables packaged)",
        "Rack elevations + LIUs if OM3/aux path",
        "Panel breaker schedule",
        "IP as-built synced to worksheet",
        "ACM screenshots / export bundle",
        "Megger/FOL certs if mandated",
        "Warranty registrar + spare kit list",
        "Training roster (when applicable)",
        "Punch closures w/photos",
        "O&amp;M + escalation card",
        "Cyber SSPS conformance statement recorded",
        "Cisco/optics serial log (continuation table below)",
        "Portal uploads / acknowledgement screenshots",
        "VPN rollover request post-window",
        "Finance backup binder (internal optional)",
    )
    for ln in checklist:
        story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;<b>⃞</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + ln, sw["body"]))
    story.append(Spacer(1, 0.08 * inch))
    story.append(
        Paragraph(
            "<b>Cisco / optics serial capture continuation</b> (<i>Use extra rows attach sheet.</i>)", sw["body"]
        )
    )
    h8 = ["#", "Device role", "Model", "Host", "Serial", "Portal note"]
    story.append(blank_grid(h8, [tw / len(h8)] * len(h8), 18))

    story += sign_block(sw, ("QIS PM", "CEVA turnover witness"))
    story.append(PageBreak())

    # --- Form 09
    story += form_header(sw, "09", "Network Support IP Sheet — Receipt", "Coordination (pre commissioning)")
    story += site_meta_table(sw)
    story.append(
        Paragraph(
            "<i>Demonstrate worksheet obtainment before DHCP/static burn on Mercury or ACM adjunct.</i>",
            sw["intro"],
        )
    )
    f09 = Table(
        [
            ["Receipt date", ""],
            ["Received by QIS print", ""],
            ["Transmission method/email ref", ""],
            ["Deviation log ID", ""],
            ["Closed date", ""],
            ["Attachments / hyperlink", ""],
            ["STPM acknowledgement", ""],
        ],
        colWidths=[tw * 0.52, tw * 0.48],
        rowHeights=[ROW_H_WRITABLE + 10] * 7,
        style=TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOX", (0, 0), (-1, -1), 0.55, NAVY),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
            ]
        ),
    )
    story.append(f09)

    story += sign_block(sw, ("Superintendent",))
    story.append(PageBreak())

    # --- Form 10
    story += form_header(sw, "10", "Auxiliary / IDF Fiber Change Notice", "Triggered &gt;500 ft or directional change")
    story += site_meta_table(sw)
    f10_txt = Table(
        [
            ["Survey reference / rationale", ""],
            ["Cable door IDs impacted", ""],
            ["Aux panel designation", ""],
            ["Fiber BOM / strands", ""],
            ["LIU / patch roadmap", ""],
            ["Extra LP/MR forecast", ""],
            ["Budget / CR # / CO ref", ""],
            ["Approved signature date — CEVA", ""],
            ["Operational reschedule note", ""],
        ],
        colWidths=[tw * 0.5, tw * 0.5],
        rowHeights=[ROW_H_WRITABLE + 12] * 9,
        style=TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOX", (0, 0), (-1, -1), 0.55, NAVY),
                ("INNERGRID", (0, 0), (-1, -1), 0.22, colors.lightgrey),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F3F7FB")),
            ]
        ),
    )
    story.append(f10_txt)
    story += sign_block(sw, ("QIS PM / prefab", "STPM / Site Leadership"))
    story.append(PageBreak())

    # --- Form 11
    story += form_header(sw, "11", "HID / Corporate Credential Hold & Release", "Pre-material release gate")
    story += site_meta_table(sw)
    story.append(
        Paragraph(
            "<b>⃞ Workbook finalized &nbsp;&nbsp; ⃞ Approval email attached &nbsp;&nbsp; "
            "⃞ Revised ship timeline noted</b>",
            sw["body"],
        )
    )
    story.append(
        Table(
            [
                ["Hold rationale / date:", ""],
                ["Approver:", ""],
                ["Release TS & ticket/email ID:", ""],
                ["Distributor quote link:", ""],
                ["Phasing / substitutions:", ""],
            ],
            colWidths=[tw * 0.45, tw * 0.55],
            rowHeights=[ROW_H_WRITABLE + 6] * 5,
            style=TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BOX", (0, 0), (-1, -1), 0.55, NAVY),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ]
            ),
        )
    )

    story += sign_block(sw, ("QIS PM Purchasing",))

    story.append(PageBreak())

    # --- Form 12
    story += form_header(sw, "12", "Daily Toolbox / Coordination Digest", "Optional diary")
    story += site_meta_table(sw)
    h12 = ["Date", "Weather/lifts?", "Toolbox topics", "CEVA POCs", "Outages/time", "Risks / carry"]
    story.append(blank_grid(h12, [tw / len(h12)] * len(h12), 18))

    story += sign_block(sw, ("Supt / Foreman",))

    return story


def main() -> None:
    story = build_story()
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=LETTER,
        leftMargin=0.62 * inch,
        rightMargin=0.62 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.62 * inch,
        title="CEVA ACS Closeout Workbook — QIS",
        author="Quality Installation Systems",
    )
    doc.build(story)
    print(f"Wrote: {OUT_PDF}")


if __name__ == "__main__":
    main()
