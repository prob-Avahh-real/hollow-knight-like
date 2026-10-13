# Hollowwood Knight

一个基于浏览器的 Hollow Knight 风格原型游戏。

## 玩法说明

- ← / → 控制移动
- Z 跳跃
- X 攻击
- 向右移动，进入光门即可获胜

## 目录结构

- `index.html`：游戏入口页面
- `style.css`：界面样式
- `game.js`：核心游戏逻辑

## 运行方式

直接打开 `index.html` 或使用本地静态服务器预览，例如：

```bash
cd hollow-knight-like
python3 -m http.server 8000
```

然后浏览器打开 `http://127.0.0.1:8000`。

## 跨平台适配说明

本项目为浏览器原型，适用于支持 HTML5 Canvas 和 JavaScript 的浏览器或 WebView 环境。已加入手柄支持，可在支持手柄输入的环境下使用 Xbox/PlayStation/Switch 控制器。

- Windows / MacOS / Linux：推荐使用 Chrome、Edge、Firefox、Safari 等浏览器进行游玩。
- PlayStation：如果主机浏览器支持 WebGL/Canvas，则可直接运行。
- Nintendo Switch：支持可用浏览器或 WebView 运行。
- Xbox / Xbox Game Pass：可在 Xbox 的浏览器或 Edge WebView 中运行，并识别手柄输入。

如果需要进一步打包为桌面或主机原生应用，可以考虑将本游戏封装为 Electron / Tauri / CEF 桌面应用，或在主机平台的 WebView / 浏览器环境中部署。
