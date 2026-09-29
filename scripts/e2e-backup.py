"""
PMOS バックアップ（書き出し／読み込み）E2E
A：データ作成→書き出し
B（空）：復元・反映・再起動後保持・再書き出し → D：再読み込み
C（既存データあり）：先に現在データを書き出し・キャンセル・不正ファイル・
   書き込み失敗3種（Routine側失敗／Tasks側失敗→元に戻る／元に戻す処理も失敗→復旧）・置き換え
D：空データ（保存先未作成）のバックアップ復元
"""
import asyncio, json, os, shutil, subprocess, time, signal, datetime, urllib.request
from playwright.async_api import async_playwright, expect

S = "/tmp/claude-0/-home-claude/8561148d-4ebf-56ad-8b67-56343a71985f/scratchpad/"
OUT = os.environ.get("E2E_OUT", S + "pmos-backup/")
CHROME = os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
APP_DIR = os.environ.get("APP_DIR", "/home/claude/personal-manager-os")
PORT = 3700
BASE = f"http://localhost:{PORT}"
RK, TK = "pmos:local:v2", "pmos:tasks:v1"
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
    return await page.evaluate(f"({{r: localStorage.getItem('{RK}'), t: localStorage.getItem('{TK}')}})")

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

async def close_menu(page):
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(300)

async def download(page, button_name, path):
    async with page.expect_download() as info:
        await page.get_by_role("button", name=button_name).click()
    d = await info.value
    await d.save_as(path)
    return json.load(open(path))

async def export(page, path):
    await open_menu(page)
    data = await download(page, "書き出す", path)
    await close_menu(page)
    return data

async def pick_file(page, path):
    await open_menu(page)
    await page.get_by_test_id("backup-input").set_input_files(path)
    await page.wait_for_timeout(400)

def as_raw(obj):
    return None if obj is None else json.dumps(obj, separators=(",", ":"), ensure_ascii=False)

INJECT = {
    "routine": f"""() => {{
      const o = Storage.prototype.setItem; window.__undo = () => {{ Storage.prototype.setItem = o; }};
      Storage.prototype.setItem = function (k, v) {{ if (k === '{RK}') throw new DOMException('q', 'QuotaExceededError'); return o.call(this, k, v); }};
    }}""",
    "tasks": f"""() => {{
      const o = Storage.prototype.setItem; window.__undo = () => {{ Storage.prototype.setItem = o; }};
      Storage.prototype.setItem = function (k, v) {{ if (k === '{TK}') throw new DOMException('q', 'QuotaExceededError'); return o.call(this, k, v); }};
    }}""",
    # Tasks は書けない ＋ Routine は1回目だけ書けて、元に戻す2回目は失敗
    "tasks+rollback": f"""() => {{
      const o = Storage.prototype.setItem; window.__undo = () => {{ Storage.prototype.setItem = o; }};
      let n = 0;
      Storage.prototype.setItem = function (k, v) {{
        if (k === '{TK}') throw new DOMException('q', 'QuotaExceededError');
        if (k === '{RK}') {{ n += 1; if (n > 1) throw new DOMException('q', 'QuotaExceededError'); }}
        return o.call(this, k, v);
      }};
    }}""",
}

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
            # ================= A：データ作成 → 書き出し =================
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
            ok("書き出し：形式バージョン・保存先情報",
               fileA["app"] == "personal-manager-os" and fileA["formatVersion"] == 1
               and fileA["sources"] == {"routine": {"key": RK, "present": True}, "tasks": {"key": TK, "present": True}})
            ok("書き出し：保存データを丸ごと含む（Routine・記録・Focus・Tasks）",
               as_raw(fileA["data"]["routineStore"]) == A["r"] and as_raw(fileA["data"]["taskStore"]) == A["t"],
               f"Routine {len(fileA['data']['routineStore']['routines'])}件・Task {len(fileA['data']['taskStore']['tasks'])}件")
            await ctxA.close()

            # ================= B：空の端末へ復元 =================
            ctxB, b = await device(p, "B")
            await goto_today(b)
            B0 = await storage(b)
            await pick_file(b, OUT + "backup-A.json")
            prev = " ".join((await b.locator("[data-backup-preview]").inner_text()).split())
            ok("空の端末：概要（作成日時・Routine・記録・Task・形式バージョン）",
               all(w in prev for w in ["作成日時", "Routine 2件", "記録 1日分", "Task 2件（未完了 1・完了 1）", "形式 バージョン 1"]), prev[:140])
            ok("空の端末：現在データが無いので「先に書き出す」は出ない",
               await b.get_by_role("button", name="先に現在のデータを書き出す").count() == 0)
            ok("空の端末：確定前はデータ未変更", await storage(b) == B0)
            await b.get_by_role("button", name="置き換える").click()
            await expect(b.get_by_text("バックアップから復元しました")).to_be_visible()
            ok("空の端末：復元後の保存データがAと一致", await storage(b) == A)
            ok("空の端末：復元直後は達成演出が出ない", await b.get_by_text("必須Routineすべて達成 —", exact=False).count() == 0)
            await close_menu(b)
            b_stat = " ".join((await b.locator("section", has=b.get_by_text("今日の達成率")).first.inner_text()).split())
            body = await b.inner_text("body")
            ok("空の端末：画面に即反映（Routine・Streak・Tasks）", b_stat == a_stat and "日報提出" in body and "報告書作成" in body, b_stat)
            await b.screenshot(path=OUT + "03_restored_today.png")
            await ctxB.close()
            ctxB, b = await device(p, "B")
            await goto_today(b)
            ok("空の端末：再起動後も残る", await storage(b) == A)
            fileB = await export(b, OUT + "backup-B.json")
            ok("再書き出し：データ部分が元と一致", fileB["data"] == fileA["data"])
            await ctxB.close()

            # ================= D：再書き出しファイルの読み込み → 空データの復元 =================
            ctxD, d = await device(p, "D")
            await goto_today(d)
            await pick_file(d, OUT + "backup-B.json")
            await d.get_by_role("button", name="置き換える").click()
            await expect(d.get_by_text("バックアップから復元しました")).to_be_visible()
            ok("書き出したファイルの再読み込み：Aと同じデータ", await storage(d) == A)
            await close_menu(d)
            # 保存先が未作成の空データ（Tasks未作成・Routine空）
            empty = {**fileA, "sources": {"routine": {"key": RK, "present": True}, "tasks": {"key": TK, "present": False}},
                     "data": {"routineStore": {"seededOn": today.isoformat(), "routines": [], "logs": {}, "focus": []}, "taskStore": None}}
            open(OUT + "empty.json", "w").write(json.dumps(empty))
            await pick_file(d, OUT + "empty.json")
            prevE = " ".join((await d.locator("[data-backup-preview]").inner_text()).split())
            ok("空データのバックアップ：概要に Routine 0件・Task 0件", "Routine 0件" in prevE and "Task 0件" in prevE)
            ok("空データ：現在データがあるので「先に書き出す」が出る",
               await d.get_by_role("button", name="先に現在のデータを書き出す").count() == 1)
            await d.get_by_role("button", name="置き換える").click()
            await expect(d.get_by_text("バックアップから復元しました")).to_be_visible()
            st = await storage(d)
            ok("空データの復元：Routine空・Tasks保存先は未作成に戻る", json.loads(st["r"])["routines"] == [] and st["t"] is None)
            await close_menu(d)
            ok("空データの復元：画面も空", "日報提出" not in await d.inner_text("body"))
            await ctxD.close()

            # ================= C：既存データあり =================
            ctxC, c = await device(p, "C")
            await goto_today(c)
            await add_routine(c, "朝礼")
            await c.goto(BASE + "/tasks"); await c.wait_for_selector("text=Tasks")
            await add_task(c, "端末Cのタスク")
            await goto_today(c)
            C0 = await storage(c)

            # 置き換え確認画面から先に現在のデータを書き出す
            await pick_file(c, OUT + "backup-A.json")
            prevC = " ".join((await c.locator("[data-backup-preview]").inner_text()).split())
            ok("既存データの端末：現在の件数（Routine 1件・Task 1件）を表示", "Routine 1件・記録 0日分・Task 1件" in prevC)
            cur = await download(c, "先に現在のデータを書き出す", OUT + "current-C.json")
            await expect(c.locator("[data-exported-current]")).to_be_visible()
            ok("確認画面から現在のデータを書き出せる（内容が端末Cと一致）",
               as_raw(cur["data"]["routineStore"]) == C0["r"] and as_raw(cur["data"]["taskStore"]) == C0["t"])
            ok("書き出しただけではデータは変わらない", await storage(c) == C0)
            await c.screenshot(path=OUT + "02_preview_with_export.png")
            await c.get_by_role("button", name="やめる").click()
            await c.wait_for_timeout(300)
            ok("キャンセル：データは変わらない", await storage(c) == C0)
            await close_menu(c)
            ok("キャンセル：画面も元のまま", "朝礼" in await c.inner_text("body"))

            # 不正ファイル
            bads = {
                "JSONではない": "これはバックアップではありません",
                "店頭ルーティンのファイル": json.dumps({"app": "shop-routine", "version": 1, "items": [], "records": {}}),
                "バージョンなし": json.dumps({k: v for k, v in fileA.items() if k != "formatVersion"}),
                "新しいバージョン": json.dumps({**fileA, "formatVersion": 2}),
                "Routine側が不正": json.dumps({**fileA, "data": {**fileA["data"], "routineStore": {**fileA["data"]["routineStore"], "routines": [{"id": "x"}]}}}),
                "Tasks側が不正": json.dumps({**fileA, "data": {**fileA["data"], "taskStore": {"version": 1, "tasks": [{**fileA["data"]["taskStore"]["tasks"][0], "title": ""}]}}}),
                "Tasks欠落": json.dumps({**fileA, "data": {"routineStore": fileA["data"]["routineStore"]}}),
            }
            for label, content in bads.items():
                path = OUT + "bad.json"
                open(path, "w").write(content)
                await pick_file(c, path)
                msg = await c.get_by_role("status").inner_text()
                ok(f"不正ファイル（{label}）：エラー・データ不変",
                   "現在のデータは変更していません" in msg and await c.locator("[data-backup-preview]").count() == 0
                   and await storage(c) == C0, msg)
                await close_menu(c)

            # ---- 書き込み失敗①：Routine側（1つ目）の書き込みに失敗
            await c.evaluate(INJECT["routine"])
            await pick_file(c, OUT + "backup-A.json")
            await c.get_by_role("button", name="置き換える").click()
            await c.wait_for_timeout(300)
            msg = await c.get_by_role("status").inner_text()
            ok("失敗①Routine側の書き込み失敗：成功と表示せず、元のデータを確認済みと表示",
               "復元できませんでした" in msg and "元のデータに戻っていることを確認しました" in msg
               and "復元しました" not in msg and await storage(c) == C0, msg)
            await c.evaluate("window.__undo()")
            await close_menu(c)

            # ---- 書き込み失敗②：Tasks側（2つ目）の書き込みに失敗 → Routineを元に戻す
            await c.evaluate(INJECT["tasks"])
            await pick_file(c, OUT + "backup-A.json")
            await c.get_by_role("button", name="置き換える").click()
            await c.wait_for_timeout(300)
            msg = await c.get_by_role("status").inner_text()
            ok("失敗②Tasks側の書き込み失敗：Routineも元に戻り、両方とも復元前のまま",
               "元のデータに戻っていることを確認しました" in msg and await storage(c) == C0, msg)
            await c.evaluate("window.__undo()")
            await close_menu(c)
            await goto_today(c)
            ok("失敗②：画面も元のまま", "朝礼" in await c.inner_text("body") and "日報提出" not in await c.inner_text("body"))

            # ---- 書き込み失敗③：Tasks側が失敗し、Routineを元に戻す処理も失敗
            await c.evaluate(INJECT["tasks+rollback"])
            await pick_file(c, OUT + "backup-A.json")
            await c.get_by_role("button", name="置き換える").click()
            await c.wait_for_timeout(400)
            panel = c.locator("[data-restore-failed]")
            txt = " ".join((await panel.inner_text()).split()) if await panel.count() else ""
            dialog_txt = await c.get_by_role("dialog").inner_text()
            ok("失敗③元に戻す処理も失敗：成功と表示しない",
               await panel.count() == 1 and "復元しました" not in dialog_txt and "復元を完了できませんでした" in dialog_txt)
            ok("失敗③：保存先ごとの状態を知らせる（Routine＝置き換わり、Tasks＝復元前）",
               "Routine・記録：バックアップの内容に置き換わっています" in txt and "Tasks：復元前のまま" in txt, txt[:120])
            st = await storage(c)
            ok("失敗③：実際の端末状態も表示どおり", st["r"] == A["r"] and st["t"] == C0["t"])
            await c.screenshot(path=OUT + "05_failed.png")
            await close_menu(c)
            ok("失敗③：誤って閉じないよう、復旧画面は残る", await c.locator("[data-restore-failed]").count() == 1)
            rescue = await download(c, "復元前のデータを書き出す", OUT + "rescue.json")
            await expect(c.locator("[data-rescued]")).to_be_visible()
            ok("失敗③：復元前のデータを書き出せる（端末Cの元データと一致）",
               as_raw(rescue["data"]["routineStore"]) == C0["r"] and as_raw(rescue["data"]["taskStore"]) == C0["t"])
            # 容量が戻らないまま再試行 → まだ失敗を正直に伝える
            await c.get_by_role("button", name="元に戻す処理をもう一度試す").click()
            await c.wait_for_timeout(300)
            msg = await c.locator("[data-restore-failed]").get_by_role("status").inner_text()
            ok("失敗③：容量不足のまま再試行 → 「まだ元に戻せません」と表示", "まだ元に戻せません" in msg, msg)
            # 容量が戻った想定 → 再試行で復旧
            await c.evaluate("window.__undo()")
            await c.get_by_role("button", name="元に戻す処理をもう一度試す").click()
            await c.wait_for_timeout(300)
            msg = await c.get_by_role("status").inner_text()
            ok("失敗③：容量回復後の再試行で復元前のデータに戻り、確認済みと表示",
               "復元前のデータに戻したことを確認しました" in msg and await storage(c) == C0, msg)
            await close_menu(c)
            await goto_today(c)
            ok("失敗③：復旧後の画面も元のまま", "朝礼" in await c.inner_text("body"))

            # 退避ファイルは読み込み可能
            await pick_file(c, OUT + "rescue.json")
            ok("失敗③：書き出した復元前データはバックアップとして読み込める",
               await c.locator("[data-backup-preview]").count() == 1)
            await c.get_by_role("button", name="やめる").click()
            await close_menu(c)

            # 既存データがある端末へ置き換え（正常）
            await pick_file(c, OUT + "backup-A.json")
            await c.get_by_role("button", name="置き換える").click()
            await expect(c.get_by_text("バックアップから復元しました")).to_be_visible()
            ok("既存データの端末：置き換え後はAと一致", await storage(c) == A)
            await close_menu(c)
            body = await c.inner_text("body")
            ok("既存データの端末：画面に反映", "日報提出" in body and "朝礼" not in body and "報告書作成" in body)
            await ctxC.close()
            ctxC, c = await device(p, "C")
            await goto_today(c)
            ok("既存データの端末：再起動後も残る", await storage(c) == A)
            await c.get_by_role("button", name="増やす").first.click()
            await c.wait_for_timeout(300)
            await c.goto(BASE + "/tasks"); await c.wait_for_selector("[data-section]")
            await add_task(c, "復元後のタスク")
            ok("復元後もRoutine記録・Task追加が通常どおり動く",
               await c.locator("[data-task]").count() >= 2 and (await storage(c))["r"] != A["r"])
            ok("ページエラーなし", not c.errors, "; ".join(c.errors)[:200])
            await ctxC.close()
    finally:
        os.killpg(srv.pid, signal.SIGTERM)
    print(f"\n=== SUMMARY === {sum(r[1] for r in results)}/{len(results)} passed")

asyncio.run(main())
