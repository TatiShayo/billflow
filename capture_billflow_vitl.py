import asyncio
import os
import shutil
from playwright.async_api import async_playwright

PAGES = [
    ("billflow_home_desktop", "/", 1280, 800),
    ("billflow_home_mobile", "/", 375, 812),
    ("billflow_login_desktop", "/login", 1280, 800),
    ("billflow_dashboard_desktop", "/dashboard", 1280, 800),
    ("billflow_pay_desktop", "/pay/demo-token", 1280, 800),
]

EVIDENCE_DIR = r"C:\Users\TATI\Desktop\DEV\billflow\EVIDENCE"
ARTIFACTS_DIR = r"C:\Users\TATI\.gemini\antigravity\brain\35201cba-1153-417d-a60f-b67c3d5580c1"

os.makedirs(EVIDENCE_DIR, exist_ok=True)
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        for name, path, width, height in PAGES:
            url = f"http://localhost:3000{path}"
            context = await browser.new_context(
                viewport={"width": width, "height": height},
                ignore_https_errors=True
            )
            page = await context.new_page()
            
            try:
                print(f"Navigating to {url} ({width}x{height})...")
                await page.goto(url, timeout=30000, wait_until="networkidle")
                await asyncio.sleep(2)
                
                out_png = os.path.join(EVIDENCE_DIR, f"{name}.png")
                art_png = os.path.join(ARTIFACTS_DIR, f"{name}.png")
                
                await page.screenshot(path=out_png, full_page=True)
                shutil.copy2(out_png, art_png)
                print(f"CAPTURED: {out_png}")
            except Exception as e:
                print(f"ERROR capturing {url}: {e}")
            finally:
                await context.close()
                
        await browser.close()
        print("VITL Capture Finished Successfully.")

if __name__ == "__main__":
    asyncio.run(main())
