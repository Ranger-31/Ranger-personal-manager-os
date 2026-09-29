"""
復元失敗画面（元に戻す処理も失敗した状態）で、閉じる操作が実際にどうなるかを検証する。
書き出し前／書き出し後それぞれで、×・「このまま閉じる」・背景タップ・下スワイプ・Escキーを試す。
E2E_OUT で出力先を指定（修正前・修正後の比較用）。
"""
import asyncio, json, os, shutil, subprocess, time, signal, urllib.request
from playwright.async_api import async_playwright, expect

S = "/tmp/claude-0/-home-claude/8561148d-4ebf-56ad-8b67-56343a71985f/scratchpad/"
OUT = os.environ.get("E2E_OUT", S + "pmos-failed-close/")
CHROME = os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
APP_DIR = os.environ.get("APP_DIR", "/home/claude/personal-manager-os")
PORT = 3701
BASE = f"http://localhost:{PORT}"
RK, TK = "pmos:local:v2", "pmos:tasks:v1"
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
rows = []

INJECT = f"""() => {{
  const o = Storage.prototype.setItem; window.__undo = () => {{ Storage.prototype.setItem = o; }};
  let n = 0;
  Storage.prototype.setItem = function (k, v) {{
    if (k === '{TK}') throw new DOMException('q', 'QuotaExceededError');
    if (k === '{RK}') {{ n += 1; if (n > 1) throw new DOMException('q', 'QuotaExceededError'); }}
    return o.call(this, k, v);
  }};
}}"""

async def storage(page):
    return await page.evaluate(f"({{r: localStorage.getItem('{RK}'), t: localStorage.getItem('{TK}')}})")

async def goto_today(page):
    await page.goto(BASE + "/today")
    await page.wait_for_selector("text=今日の達成率")
    await page.wait_for_timeout(400)

async def add_routine(page, name):
    await page.get_by_role("button", name="Routineを追加").click()
    await page.get_by_placeholder("例：法人1社へ電話").fill(name)
    await page.get_by_role("button", name="追加する").click()
    await page.wait_for_timeout(700)

async def add_task(page, title):
    await page.goto(BASE + "/tasks"); await page.wait_for_selector("text=Tasks")
    await page.get_by_role("button", name="タスクを追加").click()
    await page.get_by_placeholder("例：報告書作成").fill(title)
    await page.get_by_role("button", name="追加する").click()
    await page.wait_for_timeout(300)

async def open_menu(page):
    await page.get_by_role("button", name="メニュー").click()
    await expect(page.get_by_role("dialog")).to_be_visible()

async def set_storage(page, st):
    await page.evaluate("""([rk, tk, st]) => {
      if (window.__undo) window.__undo();
      localStorage.clear();
      if (st.r !== null) localStorage.setItem(rk, st.r);
      if (st.t !== null) localStorage.setItem(tk, st.t);
    }""", [RK, TK, st])

async def enter_failed(page, C0, backup_path):
    await goto_today(page)
    await set_storage(page, C0)
    await goto_today(page)
    await page.evaluate(INJECT)
    await open_menu(page)
    await page.get_by_test_id("backup-input").set_input_files(backup_path)
    await page.wait_for_timeout(400)
    await page.get_by_role("button", name="置き換える").click()
    await expect(page.locator("[data-restore-failed]")).to_be_visible()

async def swipe_down(page):
    box = await page.get_by_role("dialog").bounding_box()
    cdp = await page.context.new_cdp_session(page)
    x, y0 = 195, box["y"] + 12
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y0}]})
    for i in range(1, 11):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y0 + i * 60}]})
        await page.wait_for_timeout(16)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})

async def run_op(page, op):
    dialog = page.get_by_role("dialog")
    if op == "×":
        btn = dialog.get_by_role("button", name="閉じる", exact=True)
        if await btn.count() == 0 or not await btn.is_visible():
            return "表示なし"
        await btn.click()
    elif op == "閉じるボタン":
        btn = dialog.get_by_role("button", name="復元は完了していません", exact=False)
        if await btn.count() == 0 or not await btn.is_visible():
            return "表示なし"
        await btn.click()
    elif op == "背景タップ":
        await page.touchscreen.tap(195, 20)
    elif op == "下スワイプ":
        await swipe_down(page)
    elif op == "Escキー":
        await page.keyboard.press("Escape")
    await page.wait_for_timeout(500)
    return "操作"

async def main():
    srv = subprocess.Popen(["npx", "next", "start", "-p", str(PORT)], cwd=APP_DIR,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE + "/today", timeout=1); break
        except Exception:
            time.sleep(0.5)
    try:
        async with async_playwright() as p:
            ctx = await p.chromium.launch_persistent_context(
                OUT + "profile", executable_path=CHROME, viewport={"width": 390, "height": 844},
                device_scale_factor=2, is_mobile=True, has_touch=True, locale="ja-JP", timezone_id="Asia/Tokyo",
                accept_downloads=True)
            page = ctx.pages[0]
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))

            # バックアップ元のデータ → 書き出し
            await goto_today(page)
            await add_routine(page, "日報提出")
            await add_task(page, "報告書作成")
            await goto_today(page)
            await open_menu(page)
            async with page.expect_download() as info:
                await page.get_by_role("button", name="書き出す").click()
            backup_path = OUT + "backup.json"
            await (await info.value).save_as(backup_path)
            await page.keyboard.press("Escape")

            # 復元先の端末データ（C0）
            await page.evaluate("localStorage.clear()")
            await goto_today(page)
            await add_routine(page, "朝礼")
            await add_task(page, "端末のタスク")
            await goto_today(page)
            C0 = await storage(page)

            for phase in ["書き出し前", "書き出し後"]:
                for op in ["×", "閉じるボタン", "背景タップ", "下スワイプ", "Escキー"]:
                    await enter_failed(page, C0, backup_path)
                    if phase == "書き出し後":
                        async with page.expect_download() as info:
                            await page.get_by_role("button", name="復元前のデータを書き出す").click()
                        rescue_path = OUT + f"rescue-{op}.json"
                        await (await info.value).save_as(rescue_path)
                        await expect(page.locator("[data-rescued]")).to_be_visible()
                        rescue = json.load(open(rescue_path))
                        rescue_ok = (json.dumps(rescue["data"]["routineStore"], separators=(",", ":"), ensure_ascii=False) == C0["r"])
                    else:
                        rescue_ok = None
                    if op == "×":
                        await page.screenshot(path=OUT + f"failed-{phase}.png")
                    shown = await run_op(page, op)
                    dialog_open = await page.get_by_role("dialog").count() > 0
                    panel = await page.locator("[data-restore-failed]").count() > 0
                    after = "失敗画面のまま" if panel else ("シートは開いたまま・失敗画面は消えた" if dialog_open else "シートが閉じた")
                    # 閉じた／消えた後も、復元前データを書き出せるか（メニューを開き直して確認）
                    recover = "-"
                    if not panel:
                        if not dialog_open:
                            await open_menu(page)
                        recover = "開き直すと失敗画面あり" if await page.locator("[data-restore-failed]").count() else "開き直しても失敗画面なし（復元前データの控えは消えた）"
                    st_after = await storage(page)
                    data_note = "端末データは失敗時のまま（Routine置換・Tasks元のまま）" if st_after["t"] == C0["t"] and st_after["r"] != C0["r"] else "端末データが変化"
                    recover += "／" + data_note
                    rows.append((phase, op, shown, after, recover, rescue_ok))
                    print(f"{phase}\t{op}\t{shown}\t{after}\t{recover}\t書き出し一致={rescue_ok}", flush=True)
                    if phase == "書き出し後" and op == "×":
                        await page.goto(BASE + "/today")  # 画面をリセット
                    await page.evaluate("window.__undo && window.__undo()")

            await ctx.close()
            print("pageerrors:", errors)
            json.dump(rows, open(OUT + "results.json", "w"), ensure_ascii=False, indent=1)
    finally:
        os.killpg(srv.pid, signal.SIGTERM)

asyncio.run(main())
