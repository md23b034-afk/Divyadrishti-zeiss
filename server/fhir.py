"""Map a DivyaDrishti case to a FHIR R4 collection Bundle.

Resources: Patient, QuestionnaireResponse (the adaptive anamnesis, with the
original-language transcript), Observations (functional vision profile,
measurements), VisionPrescription (the patient's old prescription, if
dictated), Flag (each triage flag), ServiceRequest (referral) and, once
reviewed, Practitioner + ClinicalImpression.

Codes use a local code system for now. Mapping to LOINC/SNOMED CT and to the
NRCeS (ABDM) FHIR profiles is listed as next work in docs/BRIDGE.md.
"""
from __future__ import annotations

import uuid
from typing import Any

LOCAL = "urn:divyadrishti:code"
QUESTIONNAIRE = "urn:divyadrishti:questionnaire:anamnesis-v1"


def _ref(rid: str) -> dict:
    return {"reference": f"urn:uuid:{rid}"}


def _code(code: str, display: str) -> dict:
    return {"coding": [{"system": LOCAL, "code": code, "display": display}], "text": display}


def _qty(value: float, unit: str, ucum: str) -> dict:
    return {"value": value, "unit": unit, "system": "http://unitsofmeasure.org", "code": ucum}


def _answer(value: Any) -> list[dict]:
    if isinstance(value, bool):
        return [{"valueBoolean": value}]
    if isinstance(value, (int, float)):
        return [{"valueDecimal": value}]
    if isinstance(value, list):
        return [{"valueCoding": {"system": LOCAL, "code": str(v)}} for v in value]
    if isinstance(value, dict):
        return [{"valueString": value.get("text") or ("skipped" if value.get("skipped") else str(value))}]
    if value is None:
        return []
    return [{"valueCoding": {"system": LOCAL, "code": str(value)}}]


def case_to_bundle(case: dict) -> dict:
    entries: list[dict] = []
    created = case.get("createdAt")

    def add(resource: dict) -> str:
        rid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{case['id']}/{resource['resourceType']}/{len(entries)}"))
        resource["id"] = rid
        entries.append({"fullUrl": f"urn:uuid:{rid}", "resource": resource})
        return rid

    p = case.get("patient") or {}
    gender = {"female": "female", "male": "male", "other": "other"}.get(p.get("sex"), "unknown")
    patient = {
        "resourceType": "Patient",
        "identifier": [{"system": "urn:divyadrishti:case", "value": case["id"]}],
        "name": [{"text": p.get("name") or "Pseudonymised (identity sealed to the optometrist hub)"}],
        "gender": gender,
    }
    if p.get("phone"):
        patient["telecom"] = [{"system": "phone", "value": p["phone"]}]
    if p.get("village"):
        patient["address"] = [{"text": p["village"], "country": "IN"}]
    elif p.get("pin"):
        patient["address"] = [{"postalCode": p["pin"], "country": "IN"}]
    if p.get("sealed"):
        patient["extension"] = [{"url": "urn:divyadrishti:sealed-identity", "valueString": f"{p['sealed'].get('alg')} kid {p['sealed'].get('kid')}"}]
    pid = add(patient)
    subj = _ref(pid)

    # adaptive anamnesis
    trace = [t for t in case.get("interview", {}).get("trace", []) if t.get("qid") and not t.get("event")]
    items = []
    for t in trace:
        item = {"linkId": t["qid"], "text": t.get("questionEn"), "answer": _answer(t.get("value"))}
        ext = [{"url": "urn:divyadrishti:reason-asked", "valueString": t.get("reason", "")}]
        if t.get("raw"):
            ext.append({"url": "urn:divyadrishti:spoken-answer", "valueString": f"[{t.get('lang')}] {t['raw']}"})
        item["extension"] = ext
        items.append(item)
    add({
        "resourceType": "QuestionnaireResponse",
        "questionnaire": QUESTIONNAIRE,
        "status": "completed",
        "subject": subj,
        "authored": case.get("interview", {}).get("finishedAt") or created,
        "language": {"en": "en-IN", "hi": "hi-IN", "ta": "ta-IN"}.get(case.get("lang"), "en-IN"),
        "item": items,
    })

    prof = case.get("profile") or {}
    vision = prof.get("vision") or {}
    zones = vision.get("zones") or {}
    if zones:
        add({
            "resourceType": "Observation", "status": "preliminary", "subject": subj, "effectiveDateTime": created,
            "code": _code("functional-vision-profile", "Functional vision profile"),
            "valueString": f"{vision.get('dominance')}; lens design emphasis {vision.get('designEmphasis')}",
            "component": [
                {"code": _code(f"zone-{k}", f"Share of day: {k}"), "valueQuantity": _qty(round(z["share"] * 100, 1), "%", "%")}
                for k, z in zones.items()
            ],
        })
    m = case.get("measurements") or {}
    if m.get("readingDistanceCm"):
        add({"resourceType": "Observation", "status": "preliminary", "subject": subj, "effectiveDateTime": created,
             "code": _code("habitual-near-distance", "Habitual near working distance (camera)"),
             "valueQuantity": _qty(m["readingDistanceCm"], "cm", "cm")})
    if m.get("nearPointCm"):
        add({"resourceType": "Observation", "status": "preliminary", "subject": subj, "effectiveDateTime": created,
             "code": _code("near-point-accommodation", "Near point of accommodation (camera)"),
             "valueQuantity": _qty(m["nearPointCm"], "cm", "cm"),
             "component": [{"code": _code("amplitude", "Amplitude of accommodation"),
                            "valueQuantity": _qty(round(100 / m["nearPointCm"], 2), "D", "[diop]")}]})
    pres = prof.get("presbyopia")
    if pres and pres.get("addD"):
        add({"resourceType": "Observation", "status": "preliminary", "subject": subj, "effectiveDateTime": created,
             "code": _code("estimated-near-add", "Estimated near addition (to be confirmed)"),
             "valueQuantity": _qty(pres["addD"], "D", "[diop]"),
             "note": [{"text": f"{pres.get('amplitudeSource')}; working distance {pres.get('workingDistanceCm')} cm"}]})
    for eye, side in (("R", "right"), ("L", "left")):
        va = (m.get("acuity") or {}).get(eye)
        if va and va.get("logmar") is not None:
            comps = [{"code": _code("logmar", "logMAR"), "valueQuantity": _qty(va["logmar"], "logMAR", "1")}]
            if va.get("pinholeLogmar") is not None:
                comps.append({"code": _code("pinhole-logmar", "logMAR with pinhole"), "valueQuantity": _qty(va["pinholeLogmar"], "logMAR", "1")})
            add({"resourceType": "Observation", "status": "preliminary", "subject": subj, "effectiveDateTime": created,
                 "code": _code(f"va-presenting-{side}", f"Presenting distance visual acuity, {side} eye (tumbling E, 2 m)"),
                 "valueString": f"6/{round(6 * 10 ** va['logmar'], 1)}", "component": comps})
        ams = (m.get("amsler") or {}).get(eye)
        if ams:
            add({"resourceType": "Observation", "status": "preliminary", "subject": subj, "effectiveDateTime": created,
                 "code": _code(f"amsler-{side}", f"Amsler grid, {side} eye"), "valueCodeableConcept": _code(ams, ams)})
    pd = m.get("pd")
    if pd and pd.get("binocularMm"):
        comps = [{"code": _code(f"pd-{k}", label), "valueQuantity": _qty(pd[k], "mm", "mm")}
                 for k, label in (("rightMm", "Monocular PD right"), ("leftMm", "Monocular PD left"), ("nearMm", "Near PD"))
                 if pd.get(k)]
        add({"resourceType": "Observation", "status": "preliminary", "subject": subj, "effectiveDateTime": created,
             "code": _code("pupillary-distance", "Pupillary distance (distance)"),
             "valueQuantity": _qty(pd["binocularMm"], "mm", "mm"), "component": comps,
             "method": {"text": f"phone camera, {pd.get('method')} scale"}})

    rx = (case.get("interview", {}).get("answers") or {}).get("rx_known")
    if rx and (rx.get("R") or rx.get("L")):
        specs = []
        for eye, side in (("R", "right"), ("L", "left")):
            e = rx.get(eye)
            if not e:
                continue
            spec = {"product": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/ex-visionprescriptionproduct", "code": "lens"}]},
                    "eye": side, "sphere": e.get("sph", 0)}
            if e.get("cyl"):
                spec["cylinder"] = e["cyl"]
                spec["axis"] = e.get("axis")
            if e.get("add"):
                spec["add"] = e["add"]
            specs.append(spec)
        add({"resourceType": "VisionPrescription", "status": "active", "created": created, "dateWritten": created,
             "patient": subj, "prescriber": {"display": "Previous prescription, dictated by patient"},
             "lensSpecification": specs})

    lane = (prof.get("triage") or {}).get("lane")
    for f in (prof.get("triage") or {}).get("flags", []):
        add({"resourceType": "Flag", "status": "active", "subject": subj,
             "category": [_code(f"lane-{f['lane']}", f"Triage lane {f['lane']}")],
             "code": _code(f["code"], f["title"])})
    review = case.get("review")
    if lane in ("red", "amber"):
        flags = (prof.get("triage") or {}).get("flags", [])
        add({"resourceType": "ServiceRequest", "status": "active",
             "intent": "order" if review else "proposal",
             "priority": "asap" if lane == "red" else "routine", "subject": subj, "authoredOn": created,
             "code": {"text": "Eye examination / referral"},
             "reasonCode": [{"text": f["title"]} for f in flags],
             "note": [{"text": "; ".join(f["action"] for f in flags)}]})
    if review:
        prac = add({"resourceType": "Practitioner", "name": [{"text": review["reviewer"]["name"]}],
                    "identifier": [{"system": "urn:divyadrishti:optometrist-reg", "value": review["reviewer"].get("regNo") or "unknown"}]})
        add({"resourceType": "ClinicalImpression", "status": "completed", "subject": subj, "assessor": _ref(prac),
             "date": review.get("reviewedAt"),
             "summary": f"{review.get('decisionLabel')}: {review.get('nextStep', '')}. {review.get('notes', '')}".strip()})

    return {
        "resourceType": "Bundle",
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"{case['id']}/bundle")),
        "type": "collection",
        "timestamp": created,
        "entry": entries,
    }
