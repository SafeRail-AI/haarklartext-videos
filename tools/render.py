import json, sys, subprocess, os
from playwright.sync_api import sync_playwright

base = os.path.dirname(os.path.abspath(__file__))
words = json.load(open(os.path.join(base, "words.json")))["words"]
html = open(os.path.join(base, "anim.html"), encoding="utf-8").read().replace("__WORDS__", json.dumps(words, ensure_ascii=False))
open(os.path.join(base, "anim_built.html"), "w", encoding="utf-8").write(html)

mode = sys.argv[1]  # "preview" or "video"
FPS = 30

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    pg.goto("file://" + os.path.join(base, "anim_built.html"))
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(500)
    end = pg.evaluate("window.END")
    stage = pg.locator("#stage")
    if mode == "preview":
        os.makedirs(os.path.join(base, "prev"), exist_ok=True)
        for t in [float(x) for x in sys.argv[2:]]:
            pg.evaluate(f"render({t})")
            stage.screenshot(path=os.path.join(base, "prev", f"t{t:05.2f}.png"))
    else:
        n = int(end * FPS)
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                               "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", os.path.join(base, "video_silent.mp4")],
                              stdin=subprocess.PIPE)
        for i in range(n):
            pg.evaluate(f"render({i / FPS})")
            ff.stdin.write(stage.screenshot(type="jpeg", quality=92))
            if i % 150 == 0:
                print("frame", i, "/", n, flush=True)
        ff.stdin.close(); ff.wait()
        print("done", n)
    b.close()
