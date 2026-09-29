"""
PMOS バックアップ（書き出し／読み込み）E2E
端末A：データ作成→書き出し
端末B（空）：復元 → 反映・再起動後保持 → 再書き出し → 端末Dへ再読み込み
端末C（既存データあり）：キャンセル → 不正ファイル → 途中失敗 → 置き換え
"""
import asyncio, json, os, shutil, subprocess, time, signal, datetime, urllib.request
from playwright.async_api import async_playwright, expect

S = "/tmp/claude-0/-home-claude/8561148d-4ebf-56ad-8b67-56343a71985f/scratchpad/"
OUT = S + "pmos-backup/"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
PORT = 3700
BASE = f"http://localhost:{PORT}"
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
today = datetime.date.today()
results = []

def ok(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

async def device(p, name):
    ctx = await p.chromium.launch_persistent_context(
        OUT + "profile-" + name, executable_path=CHROME, viewport={"width": 390, "height": 844},
        device_scale_factor=2, is_mobile=True, has_touch=True, locale="ja-JP", timezone_id="Asia/Tokyo",
        accept_downloads=True)
    page = ctx.pages[0]
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    return ctx, page

async def storage(page):
    return await page.evaluate("({r: localStorage.getItem('pmos:local:v2'), t: localStorage.getItem('pmos:tasks:v1')})")

async def goto_today(page):
    await page.goto(BASE + "/today")
    await page.wait_for_selector("text=今日の達成率")
    await page.wait_for_timeout(400)

async def add_routine(page, name, number=False, critical=False):
    await page.get_by_role("button", name="Routineを追加").click()
    await page.get_by_placeholder("例：法人1社へ電話").fill(name)
    if number:
        await page.get_by_role("radio", name="Number").click()
    if critical:
        await page.get_by_role("switch").click()
    await page.get_by_role("button", name="追加する").click()
    await page.wait_for_timeout(700)

async def add_task(page, title, due=None):
    await page.get_by_role("button", name="タスクを追加").click()
    await page.get_by_placeholder("例：報告書作成").fill(title)
    if due == "today":
        await page.get_by_role("button", name="今日", exact=True).click()
    elif due:
        await page.get_by_label("期限の日付").fill(due)
    await page.get_by_role("button", name="追加する").click()
    await page.wait_for_timeout(300)

async def open_menu(page):
    await page.get_by_role("button", name="メニュー").click()
    await expect(page.get_by_role("dialog")).to_be_visible()

async def export(page, path):
    await open_menu(page)
    async with page.expect_download() as info:
        await page.get_by_role("button", name="書き出す").click()
    d = await info.value
    await d.save_as(path)
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(300)
    return json.load(open(path))

async def pick_file(page, path):
    await open_menu(page)
    await page.get_by_test_id("backup-input").set_input_files(path)
    await page.wait_for_timeout(400)

async def main():
    srv = subprocess.Popen(["npx", "next", "start", "-p", str(PORT)], cwd="/home/claude/personal-manager-os",
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE + "/today", timeout=1); break
        except Exception:
            time.sleep(0.5)
    try:
        async with async_playwright() as p:
            # ================= 端末A：データ作成 → 書き出し =================
            ctxA, a = await device(p, "A")
            await goto_today(a)
            await add_routine(a, "日報提出", critical=True)
            await add_routine(a, "法人営業", number=True, critical=True)
            await goto_today(a)
            await a.get_by_role("checkbox", name="日報提出").first.click()
            await a.get_by_role("button", name="増やす").first.click()
            await a.wait_for_timeout(200)
            ok("通常操作：必須を全達成した瞬間は達成演出が出る",
               await a.get_by_text("必須Routineすべて達成 —", exact=False).count() == 1)
            await a.wait_for_timeout(3000)
            a_stat = " ".join((await a.locator("section", has=a.get_by_text("今日の達成率")).first.inner_text()).split())
            await a.goto(BASE + "/tasks"); await a.wait_for_selector("text=Tasks")
            await add_task(a, "報告書作成", due="today")
            await add_task(a, "移動手段手配", due=(today - datetime.timedelta(days=1)).isoformat())
            await a.get_by_role("checkbox", name="移動手段手配を完了にする").click()
            await a.wait_for_timeout(300)
            await goto_today(a)
            A = await storage(a)
            fileA = await export(a, OUT + "backup-A.json")
            ok("書き出し：ファイル形式（app/format/作成日時）",
               fileA["app"] == "personal-manager-os" and fileA["format"] == 1 and fileA["exportedAt"])
            ok("書き出し：Routine・記録・Tasksの全データを含む",
               json.dumps(fileA["data"]["routineStore"], separators=(",", ":"), ensure_ascii=False) == A["r"]
               and json.dumps(fileA["data"]["taskStore"], separators=(",", ":"), ensure_ascii=False) == A["t"],
               f"Routine {len(fileA['data']['routineStore']['routines'])}件・Task {len(fileA['data']['taskStore']['tasks'])}件")
            await a.screenshot(path=OUT + "01_deviceA_today.png")
            await ctxA.close()

            # ================= 端末B：空の端末へ復元 =================
            ctxB, b = await device(p, "B")
            await goto_today(b)
            B0 = await storage(b)
            await pick_file(b, OUT + "backup-A.json")
            prev = " ".join((await b.locator("[data-backup-preview]").inner_text()).split())
            ok("空の端末：概要表示（作成日時・Routine数・記録・Task数）",
               "作成日時" in prev and "Routine 2件" in prev and "Task 2件（未完了 1・完了 1）" in prev and "記録 1日分" in prev, prev[:120])
            ok("空の端末：現在のデータ件数と「置き換え」の明示", "現在のデータを置き換えます" in prev and "Routine 0件" in prev)
            ok("空の端末：確定前はデータ未変更", await storage(b) == B0)
            await b.screenshot(path=OUT + "02_preview.png")
            await b.get_by_role("button", name="置き換える").click()
            await expect(b.get_by_text("バックアップから復元しました")).to_be_visible()
            ok("空の端末：復元後の保存データが端末Aと一致", await storage(b) == A)
            ok("復元直後：達成演出（トースト）は出ない",
               await b.get_by_text("必須Routineすべて達成 —", exact=False).count() == 0)
            await b.keyboard.press("Escape"); await b.wait_for_timeout(400)
            ok("復元直後：シートを閉じた後も達成演出は出ない",
               await b.get_by_text("必須Routineすべて達成 —", exact=False).count() == 0)
            b_stat = " ".join((await b.locator("section", has=b.get_by_text("今日の達成率")).first.inner_text()).split())
            body = await b.inner_text("body")
            ok("空の端末：復元内容が画面に即反映（Routine・Streak・Tasks）",
               b_stat == a_stat and "日報提出" in body and "報告書作成" in body, b_stat)
            await b.screenshot(path=OUT + "03_restored_today.png")
            await b.goto(BASE + "/tasks"); await b.wait_for_selector("[data-section]")
            await b.locator('[data-section="done"]').get_by_role("button").first.click()
            ok("空の端末：Tasks（完了履歴含む）も復元", await b.locator("[data-task]").count() == 2)
            await ctxB.close()
            ctxB, b = await device(p, "B")
            await goto_today(b)
            ok("空の端末：再起動後も復元データが残る", await storage(b) == A and "日報提出" in await b.inner_text("body"))
            # 再書き出し
            fileB = await export(b, OUT + "backup-B.json")
            ok("書き出したファイルの再書き出し：データ部分が元と一致", fileB["data"] == fileA["data"])
            await ctxB.close()

            # ================= 端末D：再書き出しファイルを読み込み =================
            ctxD, d = await device(p, "D")
            await goto_today(d)
            await pick_file(d, OUT + "backup-B.json")
            await d.get_by_role("button", name="置き換える").click()
            await expect(d.get_by_text("バックアップから復元しました")).to_be_visible()
            ok("書き出したファイルの再読み込み：端末Aと同じデータになる", await storage(d) == A)
            await ctxD.close()

            # ================= 端末C：既存データあり =================
            ctxC, c = await device(p, "C")
            await goto_today(c)
            await add_routine(c, "朝礼")
            await c.goto(BASE + "/tasks"); await c.wait_for_selector("text=Tasks")
            await add_task(c, "端末Cのタスク")
            await goto_today(c)
            C0 = await storage(c)

            # キャンセル
            await pick_file(c, OUT + "backup-A.json")
            prevC = " ".join((await c.locator("[data-backup-preview]").inner_text()).split())
            ok("既存データの端末：概要に現在のデータ件数（Routine 1件・Task 1件）", "Routine 1件・記録 0日分・Task 1件" in prevC, prevC[-110:])
            await c.get_by_role("button", name="やめる").click()
            await c.wait_for_timeout(300)
            ok("キャンセル：データは一切変わらない", await storage(c) == C0)
            await c.keyboard.press("Escape"); await c.wait_for_timeout(300)
            ok("キャンセル：画面も元のまま", "朝礼" in await c.inner_text("body") and "日報提出" not in await c.inner_text("body"))

            # 不正ファイル
            bads = {
                "JSONではない": "これはバックアップではありません",
                "別アプリ（店頭ルーティン）のバックアップ": json.dumps({"app": "shop-routine", "version": 1, "items": [], "records": {}}),
                "形式バージョン違い": json.dumps({**fileA, "format": 99}),
                "Routineの項目欠落": json.dumps({**fileA, "data": {**fileA["data"], "routineStore": {**fileA["data"]["routineStore"], "routines": [{"id": "x"}]}}}),
                "Taskのタイトル空": json.dumps({**fileA, "data": {**fileA["data"], "taskStore": {"version": 1, "tasks": [{**fileA["data"]["taskStore"]["tasks"][0], "title": ""}]}}}),
                "Tasksデータ欠落": json.dumps({**fileA, "data": {"routineStore": fileA["data"]["routineStore"]}}),
            }
            for label, content in bads.items():
                path = OUT + "bad.json"
                open(path, "w").write(content)
                await pick_file(c, path)
                msg = await c.get_by_role("status").inner_text()
                preview = await c.locator("[data-backup-preview]").count()
                ok(f"不正ファイル（{label}）：エラー表示・データ不変",
                   "現在のデータは変更していません" in msg and preview == 0 and await storage(c) == C0, msg)
                await c.keyboard.press("Escape"); await c.wait_for_timeout(250)
            await pick_file(c, OUT + "bad.json")
            await c.screenshot(path=OUT + "04_invalid.png")
            await c.keyboard.press("Escape"); await c.wait_for_timeout(250)

            # 書き込み途中の失敗（Tasksの保存で容量不足を模擬）→ 両方とも元のまま
            await c.evaluate("""() => {
              const orig = Storage.prototype.setItem;
              window.__restoreSetItem = () => { Storage.prototype.setItem = orig; };
              Storage.prototype.setItem = function (k, v) {
                if (k === 'pmos:tasks:v1') throw new DOMException('quota', 'QuotaExceededError');
                return orig.call(this, k, v);
              };
            }""")
            await pick_file(c, OUT + "backup-A.json")
            await c.get_by_role("button", name="置き換える").click()
            await c.wait_for_timeout(300)
            msg = await c.get_by_role("status").inner_text()
            ok("途中失敗：エラー表示し、Routine・Tasksとも元のまま（片方だけ復元されない）",
               "元のデータはそのまま残しています" in msg and await storage(c) == C0, msg)
            await c.evaluate("window.__restoreSetItem()")
            await c.keyboard.press("Escape"); await c.wait_for_timeout(300)
            await goto_today(c)
            ok("途中失敗：画面も元のまま", "朝礼" in await c.inner_text("body"))

            # 既存データがある端末へ置き換え
            await pick_file(c, OUT + "backup-A.json")
            await c.get_by_role("button", name="置き換える").click()
            await expect(c.get_by_text("バックアップから復元しました")).to_be_visible()
            ok("既存データの端末：置き換え後は端末Aと一致（端末Cのデータは置き換わる）", await storage(c) == A)
            await c.keyboard.press("Escape"); await c.wait_for_timeout(400)
            body = await c.inner_text("body")
            ok("既存データの端末：画面に反映", "日報提出" in body and "朝礼" not in body and "報告書作成" in body)
            await ctxC.close()
            ctxC, c = await device(p, "C")
            await goto_today(c)
            ok("既存データの端末：再起動後も復元データが残る", await storage(c) == A)

            # 復元後の通常操作（Routine・Tasks）
            await c.get_by_role("button", name="増やす").first.click()
            await c.wait_for_timeout(300)
            await c.goto(BASE + "/tasks"); await c.wait_for_selector("[data-section]")
            await add_task(c, "復元後のタスク")
            ok("復元後もRoutine記録・Task追加が通常どおり動く",
               await c.locator("[data-task]").count() >= 2 and (await storage(c))["r"] != A["r"])
            ok("ページエラーなし", not (c.errors), "; ".join(c.errors)[:200])
            await ctxC.close()
    finally:
        os.killpg(srv.pid, signal.SIGTERM)
    print(f"\n=== SUMMARY === {sum(r[1] for r in results)}/{len(results)} passed")

asyncio.run(main())
