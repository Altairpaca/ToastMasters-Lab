# -*- coding: utf-8 -*-
"""
TMC 三官助手 · 本地离线服务器启动器
=====================================
作用：在 127.0.0.1 上开一个静态文件服务，并自动打开浏览器。

为什么要用它？
  计时器、哼哈官 其实双击 index.html 就能用（纯离线）。
  但「语法官助手」的录音转写要调用浏览器麦克风，而浏览器只在
  localhost 或 https 这些"安全上下文"里才允许用麦克风，
  直接双击（file://）会被拒绝。用本脚本起 localhost 就解决了。

用法：
  python start-server.py            # 默认端口 8765
  python start-server.py 9000       # 指定端口

作者：Altair Li <altairpaca@gmail.com>
许可证：MIT
"""
import http.server
import socketserver
import os
import sys
import threading
import webbrowser

PORT = 8765
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        print("端口参数必须是数字，已回退到默认 %d" % PORT)

# 优先服务 dist 目录（构建产物），退回仓库根
ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(os.path.dirname(ROOT), "dist")
if os.path.isdir(DIST):
    ROOT = DIST
os.chdir(ROOT)
URL = "http://127.0.0.1:%d/universal-timer.html" % PORT


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 本地工具：禁用缓存，改了文件刷新即生效
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *args):
        pass  # 静音，保持终端整洁


def main():
    try:
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        print("[X] 端口 %d 被占用或无法绑定：%s" % (PORT, e))
        print("    换个端口再试，例如：python start-server.py 8766")
        return 1
    httpd.daemon_threads = True

    print("=" * 58)
    print("  TMC 三官助手 · 本地离线版已启动")
    print("=" * 58)
    print("  地址   : %s" % URL)
    print("  目录   : %s" % ROOT)
    print("  提示   : 手机要和电脑连同一个 Wi-Fi，把上面的 127.0.0.1")
    print("           换成电脑的局域网 IP（如 192.168.x.x）即可用手机打开。")
    print("  停止   : 按 Ctrl + C")
    print("=" * 58)

    threading.Timer(0.6, lambda: webbrowser.open(URL)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
