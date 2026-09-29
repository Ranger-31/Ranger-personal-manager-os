"""
Today修正（TODAY FOCUS削除・Tasks欄を進捗カード直下へ）の検証
旧版(81a4464)で記録 → Tasks追加版(2672d3d)でタスク作成 → 今回の修正版 へ、同じ保存領域のまま順に更新。
Routine・記録・Streak と Tasks の保存データが一切変わらないこと、表示が正しいことを確認する。
"""
import asyncio, os, shutil, subprocess, time, signal, datetime, urllib.request
from playwright.async_api import async_playwright, expect

S = "/tmp/claude-0/-home-claude/8561148d-4ebf-56ad-8b67-56343a71985f/scratchpad/"
OUT = S + "pmos-focus/"
PROFILE = OUT + "profile"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
VERSIONS = {"old": S + "pmos-old", "mid": S + "pmos-mid", "new": "/home/claude/personal-manager-os"}
PORT = 3500
BASE = f"http://localhost:{PORT}"
os.makedirs(OUT, exist_ok=True)
shutil.rmtree(PROFILE, ignore_errors=True)
today = datetime.date.today()
results = []

def ok(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

def start(cwd):
    p = subprocess.Popen(["npx", "next", "start", "-p", str(PORT)], cwd=cwd, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE + "/today", timeout=1); return p
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("server")

def stop(p):
    os.killpg(p.pid, signal.SIGTERM); p.wait(timeout=10)

async def launch(p):
    return await p.chromium.launch_persistent_context(
        PROFILE, executable_path=CHROME, viewport={"width": 390, "height": 844}, device_scale_factor=2,
        is_mobile=True, has_touch=True, locale="ja-JP", timezone_id="Asia/Tokyo")

async def storage(page):
    return await page.evaluate("({v2: localStorage.getItem('pmos:local:v2'), tasks: localStorage.getItem('pmos:tasks:v1')})")

async def stat(page):
    t = await page.locator("section", has=page.get_by_text("今日の達成率")).first.inner_text()
    return " ".join(t.split())

async def main():
    async with async_playwright() as p:
        # 1) 旧版：Routine記録
        srv = start(VERSIONS["old"])
        ctx = await launch(p); page = ctx.pages[0]
        await page.goto(BASE + "/today"); await page.wait_for_selector("text=今日の達成率")
        await page.locator("#routine-r-gbp").click()
        await page.locator("#routine-r-corp-sales").get_by_role("button", name="増やす").click()
        await page.wait_for_timeout(400)
        await ctx.close(); stop(srv)

        # 2) Tasks追加版：タスクを作成（期限切れ・今日・期限なし）
        srv = start(VERSIONS["mid"])
        ctx = await launch(p); page = ctx.pages[0]
        await page.goto(BASE + "/tasks"); await page.wait_for_selector("text=Tasks")
        for title, due in [("移動手段手配", (today - datetime.timedelta(days=2)).isoformat()), ("報告書作成", "today"), ("資料整理", None)]:
            await page.get_by_role("button", name="タスクを追加").click()
            await page.get_by_placeholder("例：報告書作成").fill(title)
            if due == "today":
                await page.get_by_role("button", name="今日", exact=True).click()
            elif due:
                await page.get_by_label("期限の日付").fill(due)
            await page.get_by_role("button", name="追加する").click()
            await page.wait_for_timeout(300)
        await page.goto(BASE + "/today"); await page.wait_for_selector("text=今日の達成率"); await page.wait_for_timeout(500)
        before = await storage(page)
        stat_before = await stat(page)
        ok("更新前：旧版の記録とTasks追加版のタスクがある", before["v2"] and before["tasks"] and "TODAY FOCUS" in await page.inner_text("body"), stat_before)
        await page.screenshot(path=OUT + "before.png")
        await ctx.close(); stop(srv)

        # 3) 今回の修正版
        srv = start(VERSIONS["new"])
        ctx = await launch(p); page = ctx.pages[0]
        errors = []; page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE + "/today"); await page.wait_for_selector("text=今日の達成率"); await page.wait_for_timeout(800)
        after = await storage(page)
        body = await page.inner_text("body")
        ok("TODAY FOCUS欄が表示されない", "TODAY FOCUS" not in body and "今日の最重要" not in body)
        order = await page.evaluate("""() => {
          const main = document.querySelector('main > div');
          return [...main.children].map(el => el.matches('[data-today-tasks]') ? 'tasks'
            : el.innerText.includes('今日の達成率') ? 'progress'
            : el.querySelector('[role=radiogroup]') ? 'filter' : el.tagName.toLowerCase());
        }""")
        i = order.index("progress")
        ok("Tasks欄が進捗カードのすぐ下、その下にALL/WORK/PERSONAL", order[i + 1] == "tasks" and order[i + 2] == "filter", str(order))
        tt = " ".join((await page.locator("[data-today-tasks]").inner_text()).split())
        ok("Tasks欄：期限切れ・今日の未完了のみ", "移動手段手配" in tt and "報告書作成" in tt and "資料整理" not in tt and "2日超過" in tt, tt)
        ok("Routine・記録・Streakの保存データが変わらない", after["v2"] == before["v2"])
        ok("Tasksの保存データが変わらない", after["tasks"] == before["tasks"])
        ok("Todayの進捗表示（達成率・Routine・必須・Streak）が同じ", await stat(page) == stat_before, await stat(page))
        ok("GBPのチェックが残っている", await page.locator("#routine-r-gbp").get_attribute("aria-checked") == "true")
        await page.screenshot(path=OUT + "after_today.png")
        await page.screenshot(path=OUT + "after_today_full.png", full_page=True)

        # Tasks欄からの操作が引き続き使える
        await page.locator("[data-today-tasks]").get_by_role("button", name="報告書作成を編集").click()
        await page.wait_for_url("**/tasks**")
        await expect(page.get_by_role("dialog").get_by_text("タスクを編集")).to_be_visible()
        ok("Tasks欄タップ → Tasksで編集が開く", await page.get_by_role("dialog").get_by_placeholder("例：報告書作成").input_value() == "報告書作成")
        await page.keyboard.press("Escape")
        # 再起動後も保持
        await ctx.close()
        ctx = await launch(p); page = ctx.pages[0]
        await page.goto(BASE + "/today"); await page.wait_for_selector("text=今日の達成率"); await page.wait_for_timeout(500)
        final = await storage(page)
        ok("再起動後もRoutine・Tasksの保存データが変わらない", final["v2"] == before["v2"] and final["tasks"] == before["tasks"])
        ok("ページエラーなし", not errors, "; ".join(errors)[:200])
        await ctx.close(); stop(srv)

    print(f"\n=== SUMMARY === {sum(r[1] for r in results)}/{len(results)} passed")

asyncio.run(main())
