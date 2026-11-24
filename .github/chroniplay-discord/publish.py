#!/usr/bin/env python3
"""Fail-closed, owner-approved GitHub Discussion -> Discord bridge. Stdlib only."""

import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request

OWNER = "stenzelmaik-lang"
REPOSITORY = "stenzelmaik-lang/Chroniplay"  # umbenannt am 24.11.2026 (vorher chronik-von-kleve)
CATEGORY = "Entwicklertagebuch"
LABEL = "discord-freigabe"
WEBHOOK_NAME = "ChroniPlay · Entwicklertagebuch"
COLOR = 0x9B5CF6
MARKER = "<!-- chroniplay-discord:sent:v1 -->"
CLAIM = "<!-- chroniplay-discord:claimed:v1 -->"
GITHUB_GRAPHQL = "https://api.github.com/graphql"
DISCUSSION_URL = re.compile(
    r"https://github\.com/stenzelmaik-lang/(?:Chroniplay|chronik-von-kleve)/discussions/(\d+)"
)


class SafetyError(ValueError):
    """Reject uncertain data instead of attempting to clean it."""


def eligible(event, actor):
    discussion = event.get("discussion") or {}
    return all([
        event.get("action") == "labeled",
        (event.get("label") or {}).get("name") == LABEL,
        (event.get("sender") or {}).get("login") == OWNER,
        actor == OWNER,
        (discussion.get("user") or {}).get("login") == OWNER,
        (discussion.get("category") or {}).get("name") == CATEGORY,
        isinstance(discussion.get("number"), int),
    ])


def validate_public_text(value, *, max_length, is_title=False):
    if not isinstance(value, str):
        raise SafetyError("Feld fehlt")
    s = unicodedata.normalize("NFKC", value).strip()
    if not s or len(s) > max_length or len(s) < 12:
        raise SafetyError("Feldlänge außerhalb des erlaubten Bereichs")
    if any(unicodedata.category(c)[0] == "C" for c in s):
        raise SafetyError("Steuerzeichen nicht erlaubt")
    if re.search(r"https?://|www\.|\b(?:[a-z0-9-]+\.)+(?:de|com|org|net|cc|io|dev|app|gg)\b", s, re.I):
        raise SafetyError("Links sind nicht erlaubt")
    if re.search(r"[\\/@$<>|={}\[\]_" + chr(96) + "]", s):
        raise SafetyError("Mögliche Kennung, Erwähnung oder Pfadangabe")
    if re.search(r"\b(?:token|secret|api.?key|webhook|commit|sha|config|konfiguration|github|workflow|dateipfad)\b", s, re.I):
        raise SafetyError("Interne Bezeichnung oder Geheimnis")
    if re.search(r"\b[0-9a-f]{8,}\b|\b\d{6,}\b", s, re.I):
        raise SafetyError("Kennung nicht erlaubt")
    if re.search(r"\b(?:[A-Za-z0-9_-]+\.)+(?:ya?ml|json|ts|tsx|js|py|env|md)\b", s, re.I):
        raise SafetyError("Dateinamen nicht erlaubt")
    if is_title:
        if not re.fullmatch(r"Entwicklertagebuch #\d{1,3} [–-] .{8,}", s):
            raise SafetyError("Titel muss 'Entwicklertagebuch #N – ...' entsprechen")
    elif "#" in s:
        raise SafetyError("Kennungen im Kurztext nicht erlaubt")
    return s


def extract_summary(body):
    if not isinstance(body, str):
        raise SafetyError("Kurzfassung fehlt")
    lines = body.splitlines()
    start = None
    for i, line in enumerate(lines):
        if re.fullmatch(r"\s*#{1,3}\s+Kurzfassung\s*", line, re.I):
            start = i + 1
            break
    if start is None:
        raise SafetyError("Überschrift '## Kurzfassung' fehlt")
    content = []
    for line in lines[start:]:
        if re.match(r"\s*#{1,6}\s+", line):
            break
        if line.strip():
            content.append(line.strip())
    return validate_public_text(" ".join(content), max_length=700)


def already_posted(comments):
    return any(
        any(m in (c.get("body") or "") for m in (MARKER, CLAIM))
        and (c.get("author") or {}).get("login") in (OWNER, "github-actions", "github-actions[bot]")
        for c in comments
    )


def validate_webhook_metadata(details, expected_channel_id):
    if not re.fullmatch(r"\d{17,20}", expected_channel_id or ""):
        raise SafetyError("Erwartete Kanal-ID fehlt oder ist ungültig")
    if (details.get("type") != 1
            or str(details.get("channel_id")) != expected_channel_id
            or details.get("name") != WEBHOOK_NAME):
        raise SafetyError("Webhook gehört nicht zum freigegebenen Kanal oder Branding")


def validate_discussion_url(value, number):
    """Only accept the URL GitHub reports for this exact Discussion."""
    if not isinstance(value, str) or type(number) is not int or number < 1:
        raise SafetyError("Discussion-Link fehlt oder ist ungültig")
    match = DISCUSSION_URL.fullmatch(value)
    if not match or int(match.group(1)) != number:
        raise SafetyError("Discussion-Link stimmt nicht mit der Freigabe überein")
    return value


def build_embed(title, summary, discussion_url, number):
    trusted_url = validate_discussion_url(discussion_url, number)
    return {
        "username": WEBHOOK_NAME,
        "allowed_mentions": {"parse": [], "users": [], "roles": []},
        "embeds": [{
            "title": title,
            "url": trusted_url,
            "description": summary,
            "color": COLOR,
            "footer": {"text": "ChroniPlay – Verschiedene Welten. Eine Zeitlinie."},
        }],
    }


def request_json(url, *, headers=None, data=None, method="GET"):
    request = urllib.request.Request(
        url, data=None if data is None else json.dumps(data).encode("utf-8"),
        headers={"User-Agent": "chroniplay-discussions-bridge/1.0",
                 "Accept": "application/json", "Content-Type": "application/json",
                 **(headers or {})},
        method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)
    except (urllib.error.URLError, ValueError, TimeoutError):
        # Exceptions may include the webhook URL and must never enter logs.
        raise SafetyError("Externe API-Abfrage fehlgeschlagen") from None


def graphql(token, query, variables):
    result = request_json(GITHUB_GRAPHQL, method="POST",
                          headers={"Authorization": f"Bearer {token}"},
                          data={"query": query, "variables": variables})
    if result.get("errors") or not isinstance(result.get("data"), dict):
        raise SafetyError("GitHub-Abfrage fehlgeschlagen")
    return result["data"]


DISCUSSION_QUERY = """
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      id title url body
      author { login }
      category { name }
      labels(first: 100) { nodes { name } }
      comments(first: 100, after: $cursor) {
        nodes { body author { login } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
"""

ADD_COMMENT = """
mutation($id: ID!, $body: String!) {
  addDiscussionComment(input: {discussionId: $id, body: $body}) {
    comment { id }
  }
}
"""


def get_discussion_with_comments(token, number):
    owner, repo = REPOSITORY.split("/")
    params = {"owner": owner, "repo": repo, "number": number, "cursor": None}
    comments = []
    for _ in range(51):
        data = graphql(token, DISCUSSION_QUERY, params)
        discussion = ((data.get("repository") or {}).get("discussion"))
        if not discussion:
            raise SafetyError("Discussion nicht gefunden")
        connection = discussion["comments"]
        comments.extend(connection.get("nodes") or [])
        page = connection["pageInfo"]
        if not page.get("hasNextPage"):
            return discussion, comments
        if not page.get("endCursor"):
            raise SafetyError("Unvollständige Kommentar-Paginierung")
        params["cursor"] = page["endCursor"]
    raise SafetyError("Zu viele Kommentare für sichere Doppelpostprüfung")


def approved_live_discussion(discussion):
    return (
        (discussion.get("author") or {}).get("login") == OWNER
        and (discussion.get("category") or {}).get("name") == CATEGORY
        and LABEL in {x.get("name") for x in (discussion.get("labels") or {}).get("nodes", [])}
    )


def run():
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as file:
        event = json.load(file)
    if not eligible(event, os.environ.get("GITHUB_ACTOR")):
        print("Ignoriert: keine gültige Eigentümer-Freigabe.")
        return
    token = os.environ.get("GH_DISCUSSIONS_TOKEN")
    if not token:
        raise SafetyError("GitHub-Token fehlt")
    discussion, comments = get_discussion_with_comments(token, event["discussion"]["number"])
    if not approved_live_discussion(discussion):
        raise SafetyError("Discussion ist nicht mehr im freigegebenen Zustand")
    if already_posted(comments):
        print("Bereits versendet oder reserviert; erneuter Versand blockiert.")
        return
    title = validate_public_text(discussion["title"], max_length=180, is_title=True)
    summary = extract_summary(discussion["body"])
    payload = build_embed(title, summary, discussion["url"], event["discussion"]["number"])
    if os.environ.get("CHRONIPLAY_SEND_ENABLED") != "true":
        print("Trockenlauf erfolgreich: geprüfte Freigabe, Inhalte und Doppelpostsperre. Nichts gesendet.")
        return
    url = os.environ.get("DISCORD_WEBHOOK_CHRONIPLAY", "")
    if not re.fullmatch(r"https://discord\.com/api/webhooks/\d{17,20}/[A-Za-z0-9_-]+", url):
        raise SafetyError("Webhook-Secret fehlt oder URL ist ungültig")
    details = request_json(url)
    validate_webhook_metadata(details, os.environ.get("CHRONIPLAY_UPDATES_CHANNEL_ID"))
    # Claim BEFORE sending. Even if a later API call fails, retries cannot duplicate.
    # To retry after a failure, the owner must manually remove the claim comment.
    graphql(token, ADD_COMMENT, {"id": discussion["id"], "body": CLAIM})
    result = request_json(url + "?wait=true", method="POST",
                          data=payload)
    if not result.get("id") or str(result.get("channel_id")) != os.environ["CHRONIPLAY_UPDATES_CHANNEL_ID"]:
        raise SafetyError("Discord-Sende-Bestätigung ist nicht sicher")
    graphql(token, ADD_COMMENT, {"id": discussion["id"], "body": MARKER})
    print("Discord-Versand bestätigt und als gesendet markiert.")


if __name__ == "__main__":
    try:
        run()
    except (SafetyError, OSError, KeyError, TypeError) as exc:
        print("Sicherheitsabbruch: " + (str(exc) if isinstance(exc, SafetyError)
              else "Eingabe oder Antwort unvollständig"), file=sys.stderr)
        sys.exit(1)
