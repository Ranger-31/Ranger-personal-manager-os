"""
完全に空の保存状態から起動した場合の検証（新規利用）
- Routineが自動登録されない（法人営業などが出ない）
- Tasks を登録すると Today の進捗カード直下に出る
"""
import asyncio, os, shutil, subprocess, time, signal, datetime, urllib.request
from playwright.async_api import async_playwright, expect

S = "/tmp/claude-0/-home-claude/8561148d-4ebf-56ad-8b67-56343a71985f/scratchpad/"
OUT = S + "pmos-fresh/"
PROFILE = OUT + "profile"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
PORT = 3600
BASE = f"http://localhost:{PORT}"
os.makedirs(OUT, exist_ok=True)
shutil.rmtree(PROFILE, ignore_errors=True)
today = datetime.date.today()
results = []

def ok(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

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
            ctx = await p.chromium.launch_persistent_context(
                PROFILE, executable_path=CHROME, viewport={"width": 390, "height": 844}, device_scale_factor=2,
                is_mobile=True, has_touch=True, locale="ja-JP", timezone_id="Asia/Tokyo")
            page = ctx.pages[0]
            errors = []; page.on("pageerror", lambda e: errors.append(str(e)))

            await page.goto(BASE + "/today")
            await page.wait_for_selector("text=今日の達成率")
            await page.wait_for_timeout(600)
            body = await page.inner_text("body")
            routines = await page.evaluate("JSON.parse(localStorage.getItem('pmos:local:v2') || '{\"routines\":[]}').routines.length")
            tasks_key = await page.evaluate("localStorage.getItem('pmos:tasks:v1')")
            ok("新規起動：Routineが自動登録されない（保存データのRoutine 0件）", routines == 0, f"{routines}件")
            ok("新規起動：法人営業などの初期項目が出ない",
               all(w not in body for w in ["法人営業", "法人架電", "ポスティング", "GBP投稿", "地域調査"]))
            ok("新規起動：TODAY FOCUSが出ない", "TODAY FOCUS" not in body)
            ok("新規起動：Routine 0 / 0・Streak 0", "0 / 0" in " ".join(body.split()) and "0 DAYS" in body)
            ok("新規起動：案内『今日のRoutineはありません。＋から追加できます。』", "今日のRoutineはありません" in body)
            ok("新規起動：Tasksは空（保存キー未作成）", tasks_key is None)
            await page.screenshot(path=OUT + "01_fresh_today.png")

            # Tasks を登録
            await page.goto(BASE + "/tasks")
            await expect(page.get_by_text("タスクはまだありません")).to_be_visible()
            for title, due, cat in [
                ("移動手段手配", (today - datetime.timedelta(days=2)).isoformat(), None),
                ("報告書作成", "today", None),
                ("資料整理", None, "Personal"),
            ]:
                await page.get_by_role("button", name="タスクを追加").click()
                await page.get_by_placeholder("例：報告書作成").fill(title)
                if due == "today":
                    await page.get_by_role("button", name="今日", exact=True).click()
                elif due:
                    await page.get_by_label("期限の日付").fill(due)
                if cat:
                    await page.get_by_role("radio", name=cat).click()
                await page.get_by_role("button", name="追加する").click()
                await page.wait_for_timeout(300)
            ok("Tasks登録：3件", await page.locator("[data-task]").count() == 3)
            await page.screenshot(path=OUT + "02_tasks.png")

            await page.goto(BASE + "/today")
            await page.wait_for_selector("[data-today-tasks]")
            await page.wait_for_timeout(400)
            tt = " ".join((await page.locator("[data-today-tasks]").inner_text()).split())
            ok("Today：進捗カード直下に期限切れ・今日のタスク", "移動手段手配" in tt and "報告書作成" in tt and "資料整理" not in tt, tt)
            body = await page.inner_text("body")
            ok("Today：Tasks登録後もRoutineは自動で増えない", "法人営業" not in body and
               await page.evaluate("JSON.parse(localStorage.getItem('pmos:local:v2')).routines.length") == 0)
            await page.screenshot(path=OUT + "03_today_with_tasks.png")

            # 再起動しても初期項目が入らない
            await ctx.close()
            ctx = await p.chromium.launch_persistent_context(
                PROFILE, executable_path=CHROME, viewport={"width": 390, "height": 844}, device_scale_factor=2,
                is_mobile=True, has_touch=True, locale="ja-JP", timezone_id="Asia/Tokyo")
            page = ctx.pages[0]
            await page.goto(BASE + "/today"); await page.wait_for_selector("[data-today-tasks]")
            body = await page.inner_text("body")
            ok("再起動後：Routineは0件のまま・Tasksは保持", "法人営業" not in body and "移動手段手配" in body)
            ok("ページエラーなし", not errors, "; ".join(errors)[:200])
            await ctx.close()
    finally:
        os.killpg(srv.pid, signal.SIGTERM)
    print(f"\n=== SUMMARY === {sum(r[1] for r in results)}/{len(results)} passed")

asyncio.run(main())
