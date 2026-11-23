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
                            "Mehr Platz für eure Geschichte.")
        self.assertEqual(set(embed["embeds"][0]), {"title", "description", "color"})
        self.assertEqual(embed["allowed_mentions"]["parse"], [])
        self.assertNotIn("content", embed)


if __name__ == "__main__":
    unittest.main()
