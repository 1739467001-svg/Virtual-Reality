# 虚拟看房 · Virtual House

走进一个虚拟的室内空间：自由走动、更换家具、开关灯、切换白天黑夜。
一个无需构建、可直接在浏览器里运行的 3D 看房 / 样板间 Demo，支持 VR 头显。

A browser-based **virtual house walkthrough**. Walk through the room in
first person, rearrange and restyle the furniture, flip the lights, and switch
between day / evening / night. Built with [Three.js](https://threejs.org) and
**no build step** — it's plain HTML + ES modules loaded via an import map, so
it runs from any static host (or opened straight as `index.html`).

🔗 **在线体验 Live demo: <https://1739467001-svg.github.io/Virtual-Reality/>**

## ✨ 功能 Features

- 🚶 **第一人称漫游** — WASD / 方向键移动，鼠标转头，`Shift` 快走，带碰撞检测（不会穿墙、不会穿过家具）。
- 🛋️ **换家具** — 切换沙发颜色与款式、茶几样式（木质 / 玻璃 / 圆形）、地毯花色，地毯可显隐。
- ✋ **移动家具** — 开启“移动模式”，走到家具前点击拾起，看向地面再点击放下，所见即所得地重新布置。
- ➕ **增删家具** — 从家具目录（真皮沙发 / 锦缎单椅 / 花瓶花艺等真实 glTF，加扶手椅 / 凳子 / 边几 / 坐墩 / 绿植 / 床 / 餐桌椅 / 落地灯 / 边柜等程序化家具）放入房间；移动模式下选中后按 `Delete` 删除。
- 🗺️ **小地图** — 左上角实时平面图，显示你的位置朝向与所有家具占位（随移动同步）。
- 📤 **保存并分享** — 一键把整套布置（家具摆位 / 配色 / 装修 / 灯光 / 昼夜）编码进链接并复制，并弹出**二维码**，手机 / VR 扫码即开同一套布置；可一键重置。
- ✨ **高画质 & 真实模型** — 可开关的后期管线（UnrealBloom 辉光 + SMAA 抗锯齿，VR 下自动旁路）；家具目录内置真实 glTF 模型（真皮沙发 / 锦缎单椅 / 玻璃花瓶花艺，Khronos CC 许可，本地内置），另含按需懒加载的真实灯具（Lantern，首次放入时再下载，不拖慢首屏）。
- 🔄 **摆放与出图** — 移动模式下拾起家具后可旋转（⟲ ⟳ 按钮或 Q/E 键），朝向随分享链接一起保存；「📸 拍照」一键把当前视角导出为 PNG。
- 🎨 **选中改色 / 缩放** — 拾起目录家具后可循环换色（🎨）与放大 / 缩小（± ），颜色与尺寸一并写入分享链接（内置家具仍走「家具」里的专用配色）。
- 📐 **测量工具** — 开启「测量」，准星对准地面点两点即得直线距离（米）：实时连线 + 浮动标签，桌面 / 触屏 / VR 通用；与移动模式互斥。
- 📏 **净尺寸标注** — 「净尺寸」一键在各房间中央浮标长×宽与面积（随户型自动适配）。
- 🆘 **加载提示 & 引导** — 真实模型加载时显示「模型加载中…」；进入页即是操作引导，左上「?」随时再看。
- 🍳 **开放式厨房** — 客厅左墙一字型厨房：地柜 + 台面、吊柜、水槽与龙头、四眼灶 + 抽油烟机、独立冰箱，所有户型都有。
- 🏠 **户型切换** — 面板「户型」在 **单间 / 一室一厅 / 一室一厅一卫 / 两室一厅** 之间循环切换：卧室带窗采光（含室外景观）、配床 / 床头柜 / 吊灯；卫生间含马桶 / 带镜洗手台 / 玻璃淋浴房与瓷砖地；两室一厅含主卧 + 次卧（各带窗），中间隔墙留门相通。各房间隔墙留门洞、可自由穿行，玩家与隔墙 / 家具碰撞，小地图与「净尺寸」按户型自适应。
- 💡 **灯光控制** — 独立开关吸顶灯、落地灯；昼 / 昏 / 夜三种自然光，灯具带真实发光与投影。
- 🌦️ **天空 / 天气 / 四季 / 昼夜** — 渐变天空盒；**时间滑杆连续调节**（0–24h），太阳/月亮按真实弧线升落、星空夜晚淡入，光照 / 天空 / 雾 / 曝光全程平滑补间；**晴 / 雨 / 雪**天气（窗外雨雪粒子，阴天调暗调灰、室内同步变暗）；**春 / 夏 / 秋 / 冬**切换窗外植被与地面色。窗外含**城市天际线（夜晚亮灯）与远山**。时间 / 天气 / 季节随分享链接保存。
- 🎨 **软装切换** — 一键更换墙面颜色（暖白 / 米灰 / 雾蓝 / 鼠尾草 / 浅杏）、地板（橡木 / 胡桃 / 白蜡 / 灰木）、厨房柜体台面配色（4 套）与挂画画面（3 组），均写入分享链接。
- 🪟 **真实空间** — 带窗户（含室外景观）、半开的门、踢脚线、挂画、书架、绿植等生活化细节。
- 🥽 **VR 支持** — 兼容 WebXR 头显，右下角 `ENTER VR` 进入沉浸模式，可用手柄摇杆移动。
- 📱 **触屏支持** — 手机 / 平板上左下虚拟摇杆移动，右半屏滑动看四周。

## 🎮 操作 Controls

| 操作 Action | 键位 Key |
| --- | --- |
| 前后左右移动 Move | `W` `A` `S` `D` / 方向键 Arrow keys |
| 转动视角 Look | 移动鼠标 Mouse (点击进入后锁定指针) |
| 快走 Run | `Shift` |
| 释放鼠标 Release cursor | `Esc` |
| 切换灯光 / 家具 / 装修 | 右上角控制面板 Panel (top-right) |
| 移动家具 Move furniture | 面板开启移动模式后，点击拾起 / 放下 |
| 旋转家具 Rotate | 拾起后 `Q` / `E`，或面板 ⟲ / ⟳ 按钮 |
| 删除家具 Delete | 拾起后 `Delete` / `Backspace` / `X` |
| 拍照导出 Snapshot | 面板「📸 拍照」导出当前视角 PNG |

## 🚀 运行 Run

不需要安装任何东西，**用任意静态服务器打开即可**：

```bash
# 方式一：Python（仓库自带脚本）
python3 -m http.server 8000
# 然后浏览器访问 http://localhost:8000

# 方式二：npm
npm run serve
```

> 直接双击 `index.html`（`file://`）大多数情况下也能跑；但若浏览器对本地 ES Module
> 有安全限制，请用上面的本地服务器方式。

### 部署到 GitHub Pages

仓库已配置 **GitHub Actions 自动部署**（`.github/workflows/pages.yml`）：每次推送到
`main` 分支会**先跑冒烟测试（`npm test`），通过后**才把仓库根目录发布到 Pages —— 测试失败即
拦截、不部署，避免把坏版本推上线。本项目已上线于
<https://1739467001-svg.github.io/Virtual-Reality/>（WebXR 需要 HTTPS，Pages 默认满足）。

> 想自行部署到你自己的仓库：在 **Settings → Pages → Build and deployment** 把 Source
> 选为 **GitHub Actions** 即可；或因为是纯静态站点，也可直接选某个分支 + 根目录 `/`。

## ✅ 测试 Test

提供一个无需浏览器的冒烟测试：用 Node 加载 Three.js 与场景模块，构建房间 / 灯光 / 家具，
并跑一遍所有“换家具 / 开关灯 / 移动家具”的逻辑，验证没有运行时错误。

```bash
npm install   # 安装 three（仅测试用，浏览器端走 CDN）
npm test
# ✅ smoke test passed — 215 meshes, 6 colliders
```

## 🗂️ 结构 Structure

```
index.html              页面骨架 + import map + 控制面板 DOM
css/style.css           UI 样式（玻璃拟态面板、摇杆、进入引导页）
js/
  main.js               入口：渲染器 / 场景 / 循环 / WebXR / 后期管线 / 家具移动旋转 / 拍照
  room.js               房屋外壳：地板、天花、带门窗洞口的墙、踢脚线、室外景观
  lights.js             灯光：日光（昼昏夜）、吸顶灯、落地灯及其发光灯罩
  environment.js        户外氛围：渐变天空、昼夜平滑过渡、雨/雪粒子、四季配色
  furniture.js          家具：程序化家具 + 真实 glTF 模型 + 换装 / 碰撞 / 增删 / 布置序列化
  player.js             第一人称控制：指针锁定、WASD、触屏、逐轴滑动碰撞
  ui.js                 控制面板与触屏摇杆的事件绑定
  minimap.js            左上角 2D 小地图 HUD：实时位置朝向与家具占位
  textures.js           纯 Canvas 程序化纹理（木地板 / 地毯 / 墙面 / 挂画）
assets/models/          真实 glTF 家具模型（沙发 / 单椅 / 花瓶，Khronos CC 许可）
assets/vendor/          第三方库（qrcode.js 二维码生成，MIT）
test/smoke.mjs          Node 冒烟测试（构建场景并跑一遍所有交互逻辑）
.github/workflows/      GitHub Actions：推送 main 自动部署到 Pages
```

> 浏览器端通过 import map 从 CDN（jsDelivr）加载 Three.js r160；`npm install`
> 安装的 `three` 仅供 Node 冒烟测试使用。

## 🛠️ 技术说明 Tech notes

- **Three.js r160**，`WebGLRenderer` 开启阴影 + ACES Filmic 色调映射，物理光照单位；
  环境光照（IBL）用 `RoomEnvironment` 经 PMREM 生成，玻璃 / 金属 / 屏幕都有真实反射。
- 房屋本体与多数家具为**程序化生成**（盒子 / 圆柱 / 圆锥 + Canvas 纹理），无需美术资源；
  少量真实家具以 **glTF** 模型按需加载（随仓库本地内置，避免跨域与外链失效）。
- 可开关的**后期管线**（`EffectComposer`：UnrealBloom 辉光 + SMAA 抗锯齿 + OutputPass），
  进入 VR 时自动旁路，直接走 WebXR 渲染路径。
- 墙体通过“开洞”算法用四段拼出门窗洞口；移动 / 旋转家具用射线投射到地面平面实现。
- 碰撞采用 AABB 逐轴解算，撞墙会自然滑动而不是卡住。
- 整套布置（家具摆位 / 朝向 / 配色 / 装修 / 灯光 / 昼夜）序列化进 URL `#` 片段，可保存分享。

---

MIT License · 使用 Three.js 构建 / Built with Three.js
