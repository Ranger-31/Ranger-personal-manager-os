"""
PMOS Tasks 検証
A) 旧版(81a4464)で既存データを作る → B) 同じURL(同じ保存領域)で新版に差し替え
→ C) Tasks の全操作 → D) 再起動後の保存 → E) Routine側リセットでTasksが消えないこと
"""
import asyncio, json, os, shutil, subprocess, time, datetime, signal
from playwright.async_api import async_playwright, expect

S = "/tmp/claude-0/-home-claude/8561148d-4ebf-56ad-8b67-56343a71985f/scratchpad/"
OUT = S + "pmos-tasks/"
PROFILE = OUT + "profile"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
OLD_DIR = S + "pmos-old"
NEW_DIR = "/home/claude/personal-manager-os"
PORT = 3400
BASE = f"http://localhost:{PORT}"
os.makedirs(OUT, exist_ok=True)
shutil.rmtree(PROFILE, ignore_errors=True)

today = datetime.date.today()
iso = lambda d: d.isoformat()
results = []

def ok(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

def start_server(cwd):
    p = subprocess.Popen(["npx", "next", "start", "-p", str(PORT)], cwd=cwd,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(60):
        try:
            import urllib.request
            urllib.request.urlopen(BASE + "/today", timeout=1)
            return p
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("server did not start")

def stop_server(p):
    os.killpg(p.pid, signal.SIGTERM)
    p.wait(timeout=10)

async def launch(p):
    return await p.chromium.launch_persistent_context(
        PROFILE, executable_path=CHROME, viewport={"width": 390, "height": 844}, device_scale_factor=2,
        is_mobile=True, has_touch=True, locale="ja-JP", timezone_id="Asia/Tokyo")

async def storage(page):
    return await page.evaluate("({v2: localStorage.getItem('pmos:local:v2'), tasks: localStorage.getItem('pmos:tasks:v1'), keys: Object.keys(localStorage)})")

async def routine_stat(page):
    t = await page.locator("section", has=page.get_by_text("今日の達成率")).first.inner_text()
    return " ".join(t.split())

async def open_task(page, title):
    await page.get_by_role("button", name=f"{title}を編集").click()
    await page.wait_for_timeout(300)

async def add_task(page, title, due=None, category=None, memo=None):
    await page.get_by_role("button", name="タスクを追加").click()
    await page.get_by_placeholder("例：報告書作成").fill(title)
    if due == "today":
        await page.get_by_role("button", name="今日", exact=True).click()
    elif due:
        await page.get_by_label("期限の日付").fill(due)
    if category:
        await page.get_by_role("radio", name=category).click()
    if memo:
        await page.get_by_placeholder("例：〇〇部長へ提出", exact=False).fill(memo)
    await page.get_by_role("button", name="追加する").click()
    await page.wait_for_timeout(400)

def section(page, key):
    return page.locator(f'[data-section="{key}"]')

async def main():
    async with async_playwright() as p:
        # ---------- A) 旧版で既存データを作る ----------
        srv = start_server(OLD_DIR)
        ctx = await launch(p)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.goto(BASE + "/today")
        await page.wait_for_selector("text=TODAY FOCUS")
        await page.locator("#routine-r-gbp").click()
        await page.locator("#routine-r-corp-sales").get_by_role("button", name="増やす").click()
        await page.locator("#routine-r-corp-call").get_by_role("button", name="増やす").click()
        await page.wait_for_timeout(500)
        old_stat = await routine_stat(page)
        before = await storage(page)
        nav_old = await page.locator("nav a").all_inner_texts()
        ok("旧版：既存データ作成（Routine記録あり・Tasksキーなし）",
           before["v2"] is not None and before["tasks"] is None, f"{old_stat} / nav={nav_old}")
        await page.screenshot(path=OUT + "00_old_version.png")
        await ctx.close()
        stop_server(srv)

        # ---------- B) 新版に差し替え（同じURL・同じ保存領域） ----------
        srv = start_server(NEW_DIR)
        ctx = await launch(p)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE + "/today")
        await page.wait_for_selector("text=TODAY FOCUS")
        await page.wait_for_timeout(600)
        after = await storage(page)
        new_stat = await routine_stat(page)
        ok("更新後：既存のRoutine・記録・Streakデータが1文字も変わらない", after["v2"] == before["v2"])
        ok("更新後：Today表示（Routine数・必須・Streak）が同じ", new_stat == old_stat, new_stat)
        ok("更新後：GBPのチェックが残っている", await page.locator("#routine-r-gbp").get_attribute("aria-checked") == "true")
        nav = await page.locator("nav a").all_inner_texts()
        ok("下部ナビ：Today・Tasks・Goals・Analytics・AI", [n.strip() for n in nav] == ["Today", "Tasks", "Goals", "Analytics", "AI"], str(nav))
        ok("更新後：Todayにタスク欄は出ない（タスク0件）", await page.locator("[data-today-tasks]").count() == 0)
        await page.goto(BASE + "/tasks")
        await expect(page.get_by_text("タスクはまだありません")).to_be_visible()
        ok("更新後：Tasksは空で始まる", (await storage(page))["tasks"] is None, "保存キーは未作成（空のまま）")

        # ---------- C) Tasks 操作 ----------
        await add_task(page, "報告書作成", due="today")
        ok("タスク作成（期限：今日・区分の初期値Work）",
           await section(page, "today").get_by_text("報告書作成").count() == 1
           and await section(page, "today").get_by_text("Work", exact=True).count() == 1)
        await add_task(page, "移動手段手配", due=iso(today - datetime.timedelta(days=2)))
        od = section(page, "overdue")
        due_text = await od.locator('[data-due-tone="overdue"]').first.inner_text()
        ok("期限切れ表示（日付＋超過日数）", "2日超過" in due_text and f"{(today - datetime.timedelta(days=2)).month}/" in due_text, due_text)
        await add_task(page, "資料整理", category="Personal")
        ok("期限なし・Personal", await section(page, "nodue").get_by_text("Personal", exact=True).count() == 1)
        order = await page.locator("[data-section]").evaluate_all("els => els.map(e => e.dataset.section)")
        ok("表示順：期限切れ→今日→今後→期限なし→完了", order == ["overdue", "today", "nodue"], str(order))
        await page.screenshot(path=OUT + "01_tasks.png", full_page=True)

        # Today 連動
        await page.goto(BASE + "/today")
        tt = page.locator("[data-today-tasks]")
        tt_text = " ".join((await tt.inner_text()).split())
        ok("Today：期限切れと今日のみ表示（期限なしは出ない）",
           "移動手段手配" in tt_text and "報告書作成" in tt_text and "資料整理" not in tt_text and "期限切れ 1" in tt_text, tt_text[:80])
        ok("Today：Routineの数値はタスクの影響を受けない", await routine_stat(page) == old_stat)
        await page.screenshot(path=OUT + "02_today.png")
        await page.screenshot(path=OUT + "02b_today_full.png", full_page=True)
        # Today からタップ → Tasks 側で編集
        await tt.get_by_role("button", name="移動手段手配を編集").click()
        await page.wait_for_url("**/tasks**")
        dialog = page.get_by_role("dialog")
        await expect(dialog.get_by_text("タスクを編集")).to_be_visible()
        ok("Todayのタップ → Tasksで該当タスクの編集が開く",
           await dialog.get_by_placeholder("例：報告書作成").input_value() == "移動手段手配")
        # メモ編集
        await dialog.get_by_placeholder("例：〇〇部長へ提出", exact=False).fill("新幹線とレンタカーを手配")
        await dialog.get_by_role("button", name="保存する").click()
        await page.wait_for_timeout(400)
        await open_task(page, "移動手段手配")
        memo = await page.get_by_role("dialog").get_by_placeholder("例：〇〇部長へ提出", exact=False).input_value()
        ok("メモ編集", memo == "新幹線とレンタカーを手配", memo)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)

        # 期限変更（今日 → 明日）
        await open_task(page, "報告書作成")
        await page.get_by_role("dialog").get_by_role("button", name="明日", exact=True).click()
        await page.get_by_role("dialog").get_by_role("button", name="保存する").click()
        await page.wait_for_timeout(400)
        ok("期限変更：今日→明日で「今後」へ移動",
           await section(page, "upcoming").get_by_text("報告書作成").count() == 1
           and await section(page, "today").count() == 0)

        # 状態変更（進行中）
        await open_task(page, "資料整理")
        await page.get_by_role("dialog").get_by_role("radio", name="進行中").click()
        await page.get_by_role("dialog").get_by_role("button", name="保存する").click()
        await page.wait_for_timeout(400)
        ok("状態変更：進行中の表示", await section(page, "nodue").get_by_text("進行中").count() == 1)

        # 完了 → 履歴 → 再開
        await page.get_by_role("checkbox", name="移動手段手配を完了にする").click()
        await page.wait_for_timeout(400)
        ok("完了：期限切れから外れる", await section(page, "overdue").count() == 0)
        await section(page, "done").get_by_role("button").first.click()
        done_txt = " ".join((await section(page, "done").inner_text()).split())
        ok("完了後も履歴として確認できる（完了日つき）", "移動手段手配" in done_txt and "完了" in done_txt, done_txt[:60])
        await page.screenshot(path=OUT + "03_done.png", full_page=True)
        await page.goto(BASE + "/today")
        ok("完了するとTodayから消える", await page.locator("[data-today-tasks]").count() == 0)
        await page.goto(BASE + "/tasks")
        await section(page, "done").get_by_role("button").first.click()
        await page.get_by_role("checkbox", name="移動手段手配を再開にする").click()
        await page.wait_for_timeout(400)
        ok("再開：期限切れに戻る", await section(page, "overdue").get_by_text("移動手段手配").count() == 1)

        # 削除確認
        await open_task(page, "資料整理")
        await page.get_by_role("dialog").get_by_role("button", name="このタスクを削除").click()
        confirm = " ".join((await page.get_by_role("dialog").inner_text()).split())
        ok("削除前に確認が出る", "「資料整理」を削除しますか？" in confirm and "元に戻せません" in confirm)
        await page.screenshot(path=OUT + "04_delete_confirm.png")
        await page.get_by_role("dialog").get_by_role("button", name="やめる").click()
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)
        ok("「やめる」で削除されない", await page.get_by_text("資料整理").count() == 1)
        await open_task(page, "資料整理")
        await page.get_by_role("dialog").get_by_role("button", name="このタスクを削除").click()
        await page.get_by_role("dialog").get_by_role("button", name="削除する").click()
        await page.wait_for_timeout(400)
        ok("削除の実行", await page.get_by_text("資料整理").count() == 0)

        # Routine・記録は変わっていない（タスク操作で既存キーに書き込みなし）
        st = await storage(page)
        ok("Tasks操作後も既存Routineデータは不変", st["v2"] == before["v2"])
        await ctx.close()

        # ---------- D) 再起動後の保存 ----------
        ctx = await launch(p)
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.goto(BASE + "/tasks")
        await page.wait_for_selector("[data-section]")
        titles = await page.locator("[data-task]").evaluate_all("els => els.map(e => e.dataset.task)")
        ok("再起動後もタスクが保存されている", sorted(titles) == ["報告書作成", "移動手段手配"], str(titles))
        await open_task(page, "移動手段手配")
        ok("再起動後もメモが残る", await page.get_by_role("dialog").get_by_placeholder("例：〇〇部長へ提出", exact=False).input_value() == "新幹線とレンタカーを手配")
        await page.keyboard.press("Escape")

        # ---------- E) Routine側リセットでTasksが消えない ----------
        await page.goto(BASE + "/today")
        await page.wait_for_selector("text=TODAY FOCUS")
        tasks_before_reset = (await storage(page))["tasks"]
        await page.get_by_role("button", name="メニュー").click()
        await page.get_by_role("button", name="記録をリセットして初期状態に戻す").click()
        warn = " ".join((await page.get_by_role("dialog").inner_text()).split())
        ok("リセット確認にTasksは消えない旨を明記", "Tasks（単発タスク）は消えません" in warn)
        await page.get_by_role("button", name="消去する").click()
        await page.wait_for_timeout(800)
        st = await storage(page)
        ok("Routine側リセット後もTasksは残る", st["tasks"] == tasks_before_reset and st["v2"] != before["v2"])
        await page.goto(BASE + "/tasks")
        await page.wait_for_selector("[data-section]")
        ok("リセット後もTasks画面に2件", await page.locator("[data-task]").count() == 2)
        ok("ページエラーなし", not errors, "; ".join(errors)[:200])
        await ctx.close()
        stop_server(srv)

    print(f"\n=== SUMMARY === {sum(r[1] for r in results)}/{len(results)} passed")
    json.dump(results, open(OUT + "results.json", "w"), ensure_ascii=False, indent=1)

asyncio.run(main())
