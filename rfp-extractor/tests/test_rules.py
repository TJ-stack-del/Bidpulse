from __future__ import annotations

import json
from importlib.resources import files


def test_admin_rules_are_editable_data_with_stable_ids():
    rule_path = files("bidpulse_rfp_extractor").joinpath("rules/admin_fields.json")
    config = json.loads(rule_path.read_text(encoding="utf-8"))

    assert config["version"]
    assert len(config["fields"]) >= 7
    assert len({rule["id"] for rule in config["fields"]}) == len(config["fields"])
    for rule in config["fields"]:
        assert set(rule) >= {
            "id",
            "field",
            "cardinality",
            "score",
            "pattern",
        }
        assert rule["cardinality"] in {"single", "many"}


def test_section_synonyms_are_editable_data_with_unique_canonical_types():
    rule_path = files("bidpulse_rfp_extractor").joinpath("rules/section_synonyms.json")
    config = json.loads(rule_path.read_text(encoding="utf-8"))

    assert config["version"]
    sections = config["sections"]
    assert len(sections) >= 10
    for canonical, phrases in sections.items():
        assert canonical == canonical.lower()
        assert phrases
        for phrase in phrases:
            assert phrase == phrase.lower()

