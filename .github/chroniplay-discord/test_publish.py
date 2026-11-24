import unittest
from publish import (
    SafetyError, eligible, extract_summary, validate_public_text,
    already_posted, validate_webhook_metadata, build_embed,
)


class PublicationSafetyTests(unittest.TestCase):
    def setUp(self):
        self.payload = {
            "action": "labeled",
            "label": {"name": "discord-freigabe"},
            "sender": {"login": "stenzelmaik-lang"},
            "discussion": {
                "number": 4,
                "user": {"login": "stenzelmaik-lang"},
                "category": {"name": "Entwicklertagebuch"},
            },
        }

    def test_owner_label_on_own_discussion_is_eligible(self):
        self.assertTrue(eligible(self.payload, "stenzelmaik-lang"))

    def test_other_label_is_rejected(self):
        self.payload["label"]["name"] = "community"
        self.assertFalse(eligible(self.payload, "stenzelmaik-lang"))

    def test_other_labeler_is_rejected(self):
        self.payload["sender"]["login"] = "other-user"
        self.assertFalse(eligible(self.payload, "other-user"))

    def test_other_author_is_rejected(self):
        self.payload["discussion"]["user"]["login"] = "other-user"
        self.assertFalse(eligible(self.payload, "stenzelmaik-lang"))

    def test_other_category_is_rejected(self):
        self.payload["discussion"]["category"]["name"] = "Ideen"
        self.assertFalse(eligible(self.payload, "stenzelmaik-lang"))

    def test_not_labeled_event_is_rejected(self):
        self.payload["action"] = "edited"
        self.assertFalse(eligible(self.payload, "stenzelmaik-lang"))

    def test_summary_extracts_only_designated_heading(self):
        body = "## Kurzfassung\nEin besserer Spieltisch.\nMehr Platz für Geschichten.\n\n## Hinter den Kulissen\nGeheimes."
        self.assertEqual(extract_summary(body), "Ein besserer Spieltisch. Mehr Platz für Geschichten.")

    def test_missing_summary_is_rejected(self):
        with self.assertRaises(SafetyError):
            extract_summary("## Änderungen\nInterne Notizen.")

    def test_oversized_summary_is_rejected(self):
        with self.assertRaises(SafetyError):
            extract_summary("## Kurzfassung\n" + "Wort " * 150)

    def test_unsafe_content_is_rejected(self):
        cases = [
            "Besucht https://example.org für Infos.",
            "Schreibt uns an team@example.org.",
            "Die Datei .github/workflows/demo.yml wurde geändert.",
            "Geheim ist API_KEY=ABC123.",
            "Lade es unter www.example.com herunter.",
            "Nutzer @everyone bekommt eine Meldung.",
            "Unsere Kennung abcdef1234567890 ist bereit.",
            "Ort C:\\config\\private liegt dort.",
        ]
        for value in cases:
            with self.subTest(value=value), self.assertRaises(SafetyError):
                validate_public_text(value, max_length=700)

    def test_safe_community_text_is_allowed(self):
        sentence = "Ein Spieltisch, der euch mehr Raum lässt – mit Schutz für eure Bilder."
        self.assertEqual(validate_public_text(sentence, max_length=700), sentence)

    def test_trusted_marker_blocks_duplicate_post(self):
        marker = "<!-- chroniplay-discord:sent:v1 -->"
        self.assertFalse(already_posted([{"body": marker, "author": {"login": "other"}}]))
        self.assertTrue(already_posted([{"body": marker, "author": {"login": "github-actions[bot]"}}]))

    def test_claim_marker_blocks_retry_after_failed_post(self):
        marker = "<!-- chroniplay-discord:claimed:v1 -->"
        self.assertTrue(already_posted([{"body": marker, "author": {"login": "github-actions[bot]"}}]))

    def test_graphql_github_actions_comment_blocks_duplicate(self):
        # GitHub GraphQL returns this login for GITHUB_TOKEN comments (no [bot]).
        for marker in ('<!-- chroniplay-discord:claimed:v1 -->',
                       '<!-- chroniplay-discord:sent:v1 -->'):
            with self.subTest(marker=marker):
                self.assertTrue(already_posted([
                    {'body': marker, 'author': {'login': 'github-actions'}}
                ]))

    def test_owner_marker_also_blocks_duplicate(self):
        self.assertTrue(already_posted([
            {'body': '<!-- chroniplay-discord:sent:v1 -->',
             'author': {'login': 'stenzelmaik-lang'}}
        ]))

    def test_discussion_url_is_trusted_and_matches_event(self):
        from publish import validate_discussion_url
        valid = 'https://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/4'
        self.assertEqual(validate_discussion_url(valid, 4), valid)
        # Repository renamed on 24.11.2026: GitHub now reports the new name.
        renamed = 'https://github.com/stenzelmaik-lang/Chroniplay/discussions/4'
        self.assertEqual(validate_discussion_url(renamed, 4), renamed)
        for bad in (
            'https://github.com/other/repo/discussions/4',
            'https://github.com/stenzelmaik-lang/Chroniplay/discussions/5',
            'https://github.com/stenzelmaik-lang/Chroniplay-evil/discussions/4',
            'https://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/5',
            'https://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/4?view=1',
            'https://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/4/extra',
            'http://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/4',
            'https://github.com.evil.test/stenzelmaik-lang/chronik-von-kleve/discussions/4',
            'https://example.net/malicious',
            '', None,
        ):
            with self.subTest(url=bad), self.assertRaises(SafetyError):
                validate_discussion_url(bad, 4)

    def test_graphql_query_fetches_discussion_url(self):
        from publish import DISCUSSION_QUERY
        self.assertRegex(DISCUSSION_QUERY, r'\bid\s+title\s+url\s+body\b')

    def test_run_rejects_foreign_discussion_url_before_claim_and_send(self):
        import json
        import os
        import tempfile
        from unittest.mock import patch
        import publish

        fake_discussion = {
            'id': 'opaque-id',
            'title': 'Entwicklertagebuch #4 – Mehr Platz für Geschichten',
            'body': '### Kurzfassung\nEin besserer Spieltisch für eure gemeinsamen Geschichten.',
            'url': 'https://github.com/fremd/repo/discussions/4',
            'author': {'login': 'stenzelmaik-lang'},
            'category': {'name': 'Entwicklertagebuch'},
            'labels': {'nodes': [{'name': 'discord-freigabe'}]},
        }
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8') as event_file:
            json.dump(self.payload, event_file)
            event_file.flush()
            with patch.dict(os.environ, {
                'GITHUB_EVENT_PATH': event_file.name,
                'GITHUB_ACTOR': 'stenzelmaik-lang',
                'GH_DISCUSSIONS_TOKEN': 'dummy-test-token',
                'CHRONIPLAY_SEND_ENABLED': 'true',
            }):
                with patch.object(publish, 'get_discussion_with_comments', return_value=(fake_discussion, [])):
                    with patch.object(publish, 'graphql') as gql, patch.object(publish, 'request_json') as api:
                        with self.assertRaises(SafetyError):
                            publish.run()
                        gql.assert_not_called()
                        api.assert_not_called()

    def test_discussion_form_has_expected_headings_and_three_required_checks(self):
        from pathlib import Path
        form = (Path(__file__).resolve().parents[1] / 'DISCUSSION_TEMPLATE'
                / 'entwicklertagebuch.yml').read_text(encoding='utf-8')
        self.assertIn('title: "Entwicklertagebuch #"', form)
        for title in ('Kurzfassung', 'Abgeschlossene Verbesserungen', 'Fehlerbehebungen',
                      'Woran wir gerade arbeiten', 'Eure Meinung zählt'):
            self.assertIn(f'label: {title}', form)
        self.assertIn('id: kurzfassung', form)
        self.assertIn('required: false', form)
        checks = form.split('type: checkboxes', 1)[1]
        self.assertEqual(checks.count('required: true'), 3)

    def test_webhook_channel_name_and_type_must_all_match(self):
        good = {"type": 1, "channel_id": "123456789012345678",
                "name": "ChroniPlay · Entwicklertagebuch"}
        validate_webhook_metadata(good, "123456789012345678")
        for wrong in [
            dict(good, channel_id="000000000000000000"),
            dict(good, name="Anderer Webhook"),
            dict(good, type=2),
        ]:
            with self.subTest(wrong=wrong), self.assertRaises(SafetyError):
                validate_webhook_metadata(wrong, "123456789012345678")

    def test_embed_contains_only_title_and_summary_with_mentions_disabled(self):
        embed = build_embed("Entwicklertagebuch #4 – Ein Abend voller Geschichten",
                            "Mehr Platz für eure Geschichte.",
                            "https://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/4", 4)
        self.assertEqual(set(embed["embeds"][0]), {"title", "description", "color", "url", "footer"})
        self.assertEqual(embed["embeds"][0]["url"],
                         "https://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/4")
        self.assertEqual(embed["embeds"][0]["footer"],
                         {"text": "ChroniPlay – Verschiedene Welten. Eine Zeitlinie."})
        self.assertEqual(embed["allowed_mentions"]["parse"], [])
        self.assertNotIn("content", embed)


if __name__ == "__main__":
    unittest.main()
