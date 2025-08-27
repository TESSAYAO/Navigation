# ParkSense - 智能公园导航系统

一个基于Leaflet.js的智能公园导航Web应用，提供路径规划、POI查看、智能推荐等功能。

## 🌐 在线访问

已部署到GitHub Pages，可直接访问：
- **GitHub Pages**: [https://YOUR_USERNAME.github.io/Navigation](https://YOUR_USERNAME.github.io/Navigation)

## ✨ 功能特色

- 🗺️ **交互式地图**: 基于OpenStreetMap的高质量地图展示
- 🎯 **智能推荐**: 根据您的偏好（安静、遮阴、景观、野生动物等）推荐最佳路线
- 🧭 **路径规划**: 基于实际步道网络的最优路径计算
- 📍 **POI管理**: 丰富的兴趣点信息，包括设施、野生动物、景观等
- 🌿 **多图层展示**: 公园边界、步道、植被、水景等多种数据层
- 📱 **响应式设计**: 支持桌面和移动设备

## 🚀 GitHub Pages 部署

### 自动部署（推荐）

1. **Fork这个仓库**到您的GitHub账户
2. **启用GitHub Pages**：
   - 进入仓库设置 → Pages
   - Source选择"GitHub Actions"
3. **推送代码**：任何推送到main/master分支的代码都会自动部署
4. **访问网站**：部署完成后可通过 `https://YOUR_USERNAME.github.io/REPO_NAME` 访问

### 手动部署

1. 克隆仓库：
```bash
git clone https://github.com/YOUR_USERNAME/Navigation.git
cd Navigation
```

2. 配置GitHub Pages：
   - 仓库设置 → Pages → Source选择"Deploy from a branch"
   - 选择"main"分支和"/ (root)"文件夹

## 🛠️ 本地开发

### 方式一：Python 静态服务器
```bash
# 进入项目目录
cd Navigation

# 启动Python静态服务器
python -m http.server 8090

# 访问 http://localhost:8090
```

### 方式二：Node.js 静态服务器
```bash
# 使用npx无需安装
npx -y http-server . -p 8090

# 访问 http://localhost:8090
```

### 方式三：其他静态服务器
任何支持静态文件的Web服务器都可以运行此项目。

## 📁 项目结构

```
Navigation/
├── index.html              # 主页文件
├── js/
│   └── app.js              # 主要JavaScript逻辑
├── local-nav/
│   └── local-nav/
│       └── park-data/
│           └── park-data/   # GeoJSON数据文件
│               ├── park_boundary.geojson
│               ├── trails.geojson
│               ├── poi_all.geojson
│               └── ...
├── materials/
│   └── parksense-web-debug-clean.html  # 原始开发版本
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions部署配置
└── README.md
```

## 🔧 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **地图库**: Leaflet.js 1.9.4
- **数据格式**: GeoJSON
- **部署**: GitHub Pages
- **CI/CD**: GitHub Actions

## 📖 使用说明

1. **查看地图**: 打开应用后自动加载公园地图和各种数据层
2. **智能推荐**: 在侧边栏选择您的偏好条件，系统会推荐最佳路线
3. **路径规划**: 点击"选择起点"和"选择终点"，然后点击"规划路径"
4. **POI探索**: 使用POI控制面板筛选和查看感兴趣的地点
5. **图层管理**: 通过图层开关控制不同数据的显示

## 🌟 核心功能

### 智能推荐系统
- 根据个人偏好（安静、遮阴、景观、野生动物观察等）
- 结合路线长度和预计时间
- 智能评分算法推荐最佳路线

### 路径规划
- 基于真实步道网络的路径计算
- Dijkstra算法寻找最短路径
- 支持多路标点的复杂路线规划

### POI管理
- 18种不同类型的兴趣点
- 智能分类和颜色编码
- 支持地理过滤和数量限制

## 🔄 更新部署

对于已fork的仓库，要更新到最新版本：

1. 同步上游更改：
```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/Navigation.git
git fetch upstream
git merge upstream/main
```

2. 推送更新：
```bash
git push origin main
```

GitHub Actions会自动重新部署更新的版本。

## 📝 许可证

本项目采用MIT许可证，详情请参阅LICENSE文件。

## 🤝 贡献

欢迎提交Issue和Pull Request来帮助改进这个项目！

## 📞 联系方式

如有问题或建议，请通过GitHub Issues联系我们。