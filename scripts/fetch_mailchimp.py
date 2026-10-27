"""Récupère les statistiques de toutes les campagnes envoyées depuis Mailchimp
et les écrit dans data/campaigns.json pour le site.

Variables d'environnement :
  MAILCHIMP_API_KEY  clé API Mailchimp (format xxxxxxxx-us16), stockée en secret GitHub
"""
import base64
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "campaigns.json"
CONFIG = ROOT / "config.json"


def api(path, key):
    dc = key.rsplit("-", 1)[-1]
    url = f"https://{dc}.api.mailchimp.com/3.0{path}"
    token = base64.b64encode(f"anystring:{key}".encode()).decode()
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {token}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


PREFIX = re.compile(r"^\s*[\[(]?\s*(interne|externe)\b\s*[\])]?\s*[-–—:|/]*\s*", re.IGNORECASE)


def split_prefix(name):
    """« Interne - Titre », « [EXTERNE] Titre », « externe : Titre » -> (type, Titre)"""
    m = PREFIX.match(name or "")
    if not m:
        return None, name
    return m.group(1).lower(), name[m.end():].strip() or name


def classify(c, cfg):
    overrides = cfg.get("overrides", {})
    if c["id"] in overrides:
        return overrides[c["id"]]
    if c.get("prefix_type"):
        return c["prefix_type"]
    for kind in ("interne", "externe"):
        rule = cfg.get(kind, {})
        title = (c["title"] + " " + c["subject"]).lower()
        if any(w.lower() in title for w in rule.get("title_contains", [])):
            return kind
        if c["audience"] and c["audience"] in rule.get("audiences", []):
            return kind
    return cfg.get("default", "externe")


def main():
    key = os.environ.get("MAILCHIMP_API_KEY")
    if not key:
        sys.exit("MAILCHIMP_API_KEY manquante")
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))

    reports, offset = [], 0
    while True:
        page = api(f"/reports?count=200&offset={offset}", key)
        reports += page.get("reports", [])
        offset += 200
        if offset >= page.get("total_items", 0):
            break

    campaigns = []
    for r in reports:
        if r.get("type") not in ("regular", "plaintext", "absplit", "variate"):
            continue
        b = r.get("bounces", {})
        bounces = b.get("hard_bounces", 0) + b.get("soft_bounces", 0) + b.get("syntax_errors", 0)
        sent = r.get("emails_sent", 0)
        delivered = max(sent - bounces, 0)
        o, k = r.get("opens", {}), r.get("clicks", {})
        c = {
            "id": r["id"],
            "title": r.get("campaign_title") or r.get("subject_line", ""),
            "subject": r.get("subject_line", ""),
            "audience": r.get("list_name", ""),
            "send_time": r.get("send_time", ""),
            "sent": sent,
            "delivered": delivered,
            "bounces": bounces,
            "opens_unique": o.get("unique_opens", 0),
            "opens_total": o.get("opens_total", 0),
            "open_rate": round(o.get("open_rate", 0), 4),
            "clicks_unique": k.get("unique_subscriber_clicks", 0),
            "clicks_total": k.get("clicks_total", 0),
            "click_rate": round(k.get("click_rate", 0), 4),
            "unsubs": r.get("unsubscribed", 0),
            "abuse": r.get("abuse_reports", 0),
        }
        # Mailchimp peut compter plus d'ouvertures uniques que d'emails délivrés
        # (transferts, protection Apple Mail), on plafonne donc à 100 %
        c["opens_unique"] = min(c["opens_unique"], delivered)
        c["clicks_unique"] = min(c["clicks_unique"], delivered)
        c["open_rate"] = round(c["opens_unique"] / delivered, 4) if delivered else 0
        c["click_rate"] = round(c["clicks_unique"] / delivered, 4) if delivered else 0
        c["prefix_type"], c["title"] = split_prefix(c["title"])
        c["type"] = classify(c, cfg)
        del c["prefix_type"]
        campaigns.append(c)

    campaigns.sort(key=lambda c: c["send_time"])
    data = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "source": "mailchimp-api",
        "campaigns": campaigns,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(campaigns)} campagnes écrites dans {OUT}")


if __name__ == "__main__":
    main()
