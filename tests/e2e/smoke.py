"""End-to-end smoke test in a real browser (Playwright + installed Chrome).

Portal: the optometrist sets up identity encryption (hub key pair; recovery
file downloaded). Field app: PIN set-up -> demo patient -> consent -> adaptive
interview -> checks (the acuity staircase is actually taken) -> profile ->
send (identity sealed to the hub). Portal: the sealed name is opened in the
browser, the case is signed off, the access log shows it; the reply reaches the
phone's inbox. Fails on any browser console error (CSP violations included).

Usage (server running on BASE, fresh database):
  BASE=http://127.0.0.1:8765 OUT=shots python tests/e2e/smoke.py
"""
import math
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8765")
OUT = Path(os.environ.get("OUT", "shots"))
OUT.mkdir(parents=True, exist_ok=True)
PERSONA = os.environ.get("PERSONA", "kumar")
PIN = "246810"
errors: list[str] = []


def watch(page, tag):
    page.on("console", lambda m: m.type == "error" and errors.append(f"[{tag}] console: {m.text}"))
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror: {e}"))


def shot(page, name, full=False):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)


def unlock(page):
    """Set the PIN on first use, or enter it after a reload."""
    page.wait_for_selector("[data-screen^=pin], [data-screen=home], [data-screen=interview], [data-screen=summary], [data-screen=checks]")
    screen = page.locator("main").get_attribute("data-screen")
    if screen == "pin-set":
        page.fill("#pin1", PIN)
        page.fill("#pin2", PIN)
        page.click("#pinGo")
    elif screen == "pin-enter":
        page.fill("#pin1", PIN)
        page.click("#pinGo")
    # locator waits, not wait_for_function: the app's CSP (correctly) forbids eval
    expect(page.locator("main")).not_to_have_attribute("data-screen", re.compile(r"^pin"), timeout=20000)


def take_acuity(page, eye_label, true_logmar=0.2):
    """Answer like a patient with the given acuity: correct when the E is big enough."""
    for _ in range(40):
        if page.locator("[data-screen=check-acuity]").count() == 0:
            return
        line = page.locator("#lvl").inner_text()
        m = re.search(r"Line 6/([\d.]+)", line)
        logmar = 0.0 if not m else round(math.log10(float(m.group(1)) / 6), 1)
        rot = page.locator("svg.optotype").get_attribute("style")
        deg = int(re.search(r"rotate\((\d+)deg\)", rot).group(1))
        shown = {0: "right", 90: "down", 180: "left", 270: "up"}[deg]
        answer = shown if logmar >= true_logmar - 1e-9 else {"right": "left", "left": "up", "up": "down", "down": "right"}[shown]
        page.click(f"[data-d={answer}]")
    raise AssertionError(f"acuity {eye_label} did not finish")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True, args=[
            "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])

        # ---- optometrist hub: set up identity encryption first
        desk = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        portal = desk.new_page()
        watch(portal, "portal")
        portal.on("dialog", lambda d: d.accept())
        portal.goto(f"{BASE}/portal.html")
        portal.wait_for_selector(".crow")
        with portal.expect_download() as dl:
            portal.click("#hubSetup")
        assert dl.value.suggested_filename.startswith("divyadrishti-hub-recovery-")
        expect(portal.locator("#hubBanner")).to_contain_text("Identity encryption on", timeout=10000)

        # ---- field phone
        phone = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                    permissions=["camera", "microphone"])
        # voice off: headless Chrome has real Windows voices and would speak every question
        phone.add_init_script("localStorage.setItem('dd.settings', JSON.stringify({voice: false}))")
        page = phone.new_page()
        watch(page, "field")
        page.goto(f"{BASE}/")
        page.wait_for_selector("[data-screen=pin-set]")
        shot(page, "00_pin")
        unlock(page)
        expect(page.locator("#newBtn")).to_be_visible()
        assert page.locator(".lang").count() == 6, "six languages on the home screen"
        shot(page, "01_home")

        page.click("#checkBtn")
        page.wait_for_selector("[data-screen=phonecheck]")
        expect(page.locator(".pcheck")).to_contain_text("Optometrist hub key")
        shot(page, "01b_phonecheck", full=True)
        page.click("#home")

        # ---- demo patient through the interview (autopilot answers)
        page.click(f"[data-demo={PERSONA}]")
        page.click("#agree")
        page.wait_for_selector("[data-screen=interview]")
        expect(page.locator("#heard")).to_be_visible(timeout=15000)
        shot(page, "02_interview")
        # reload mid-interview: the encrypted draft must survive
        page.reload()
        unlock(page)
        page.wait_for_selector("#resumeBtn")
        page.click("#resumeBtn")
        page.wait_for_selector("[data-screen=checks]", timeout=120000)
        shot(page, "03_checks")

        checks = page.locator("[data-chk]").evaluate_all("els => els.map(e => e.dataset.chk)")
        print("checks suggested:", checks)
        if "acuity" in checks:
            page.click("[data-chk=acuity]")
            page.wait_for_selector("svg.optotype")
            shot(page, "04_acuity")
            take_acuity(page, "R", 0.2)
            if page.locator("[data-screen=pinhole]").count():
                page.click("#noph")
            take_acuity(page, "L", 0.2)
            page.wait_for_selector("[data-screen=checks]")
        for k in checks:
            if k == "acuity":
                continue
            page.click(f"[data-chk={k}]")
            page.wait_for_selector("#demoFill", timeout=10000)
            if k == "reading_distance":
                page.wait_for_timeout(1500)
                shot(page, "05_camera")
            page.click("#demoFill")
            page.wait_for_selector("[data-screen=checks]")
        page.click("#toSummary")
        page.wait_for_selector("[data-screen=summary]")
        page.click(".dpath summary")
        page.click(".quality summary")
        shot(page, "07_summary", full=True)
        acuity_txt = page.locator(".kv", has_text="Distance vision").inner_text()
        assert "6/9" in acuity_txt, f"staircase result not shown: {acuity_txt}"
        page.click("#sendBtn")
        expect(page.locator("#sendState")).to_contain_text("sealed", timeout=15000)
        shot(page, "08_passport", full=True)

        # ---- portal: the sealed identity opens only in the hub's browser
        portal.reload()
        portal.wait_for_selector(".crow")
        name = "S. Kumar" if PERSONA == "kumar" else None
        row = portal.locator(".crow", has_text=name).first
        expect(row).to_be_visible(timeout=15000)
        row.click()
        portal.wait_for_selector("#rvForm")
        expect(portal.locator(".dhead")).to_contain_text("sealed to this hub, opened here")
        shot(portal, "09_portal_case")
        portal.fill("textarea[name=notes]", "E2E: checked trace and measurements.")
        portal.click("#rvForm button[type=submit]")
        expect(portal.locator(".reviewed")).to_be_visible(timeout=10000)
        expect(portal.locator("table.trace").last).to_contain_text("case reviewed")
        shot(portal, "10_portal_reviewed", full=True)
        portal.click("[data-tab=planning]")
        portal.wait_for_selector(".tiles")
        shot(portal, "11_planning", full=True)

        # ---- the reply reaches the phone
        page.click("#nextPt")
        page.click("#inboxBtn")
        expect(page.locator(".inbox")).to_contain_text("🩺", timeout=10000)
        shot(page, "12_inbox")

        # ---- question screens in the new languages (static)
        for key, q, nm in (("ramulu", 5, "13_telugu"), ("sunita", 4, "14_marathi"), ("manjula", 5, "15_kannada"), ("lakshmi", 5, "16_tamil")):
            page.goto(f"{BASE}/?demo={key}&screen=interview&q={q}&still=1")
            unlock(page)
            page.wait_for_selector("[data-screen=interview]")
            page.wait_for_timeout(400)
            shot(page, nm)
        browser.close()

    benign = ("favicon", "TensorFlow Lite XNNPACK")  # MediaPipe logs this INFO line via console.error
    real = [e for e in errors if not any(b in e for b in benign)]
    if real:
        print("\n".join(real))
        sys.exit(1)
    print(f"OK: no console errors; screenshots in {OUT}")


if __name__ == "__main__":
    main()
