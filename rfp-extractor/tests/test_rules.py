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

