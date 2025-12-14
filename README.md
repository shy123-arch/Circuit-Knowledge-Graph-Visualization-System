# 电路类课程知识图谱可视化系统

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个功能完整的知识图谱可视化与科学构建系统，用于展示和管理电路、模电、数电、高频电子线路、嵌入式等课程的知识点及其关联关系。

## ✨ 功能特点

### 📊 核心功能
- **知识图谱可视化**：使用 vis-network 库实现美观的交互式知识图谱
- **节点交互**：点击任意节点查看详细信息
- **关联展示**：自动显示选中节点与其他知识点的关联关系
- **学习路径规划**：自动计算从起始节点到目标节点的学习路径
- **分类标识**：不同课程使用不同颜色区分
- **响应式设计**：支持不同屏幕尺寸

### 🔬 知识图谱科学构建功能
- **知识抽取**：从文本自动提取知识点和关系
- **知识图谱嵌入**：基于 TransE 模型学习向量表示
- **链接预测**：预测知识图谱中缺失的关系
- **相关推荐**：基于相似度推荐相关概念
- **缺失链接发现**：自动发现可能缺失的知识关联

## 📁 项目结构

```
.
├── app.py                      # Flask后端服务器
├── data.py                     # 知识图谱数据定义（120+节点，200+关系）
├── kg_extraction.py            # 知识抽取模块
├── kg_embedding.py             # TransE嵌入模型实现
├── kg_completion.py            # 链接预测和补全模块
├── train_model.py              # 模型训练脚本
├── test_kg_features.py         # 功能测试脚本
├── requirements.txt            # Python依赖包
├── environment.yml             # Conda环境配置（可选）
├── models/                     # 模型存储目录
│   └── trained_model.pkl        # 训练好的模型（需运行train_model.py生成）
├── templates/
│   └── index.html              # 前端主页面
├── static/
│   ├── css/
│   │   └── style.css           # 样式文件
│   └── js/
│       └── main.js             # 前端交互逻辑
├── README.md                   # 项目说明文档
├── README-知识图谱科学构建.md  # 科学构建功能详细说明
└── .gitignore                  # Git忽略文件
```

## 🚀 快速开始

### 环境要求

- Python 3.9+
- pip 或 conda

### 安装步骤

#### 方法一：使用 pip（推荐）

1. **克隆项目**
```bash
git clone https://github.com/shy123-arch/Circuit-Knowledge-Graph-Visualization-System.git
cd Circuit-Knowledge-Graph-Visualization-System
```

2. **安装依赖**
```bash
pip install -r requirements.txt
```

#### 方法二：使用 Conda

1. **创建环境**
```bash
conda env create -f environment.yml
conda activate knowledge-graph
```

2. **安装依赖**（如果 environment.yml 不完整）
```bash
pip install -r requirements.txt
```

### 训练模型（首次使用必须）

知识图谱科学构建功能需要先训练模型：

```bash
python train_model.py
```

**预计时间**：3-5分钟

训练完成后，模型将保存在 `models/trained_model.pkl`

### 运行项目

```bash
python app.py
```

服务器将在 `http://localhost:5000` 启动。

在浏览器中打开：`http://localhost:5000`

## 📖 使用说明

### 基础功能

1. **查看知识图谱**：页面加载后会自动显示完整的知识图谱
2. **点击节点**：点击任意知识点节点，右侧会显示该节点的详细信息
3. **查看关联**：在节点详情中可以看到：
   - 与该节点相关的其他知识点
   - 知识点之间的关联关系类型
4. **学习路径**：选择起始节点和目标节点，系统会自动计算学习路径
5. **交互操作**：
   - 拖拽：移动图谱位置
   - 滚轮：缩放图谱
   - 双击节点：聚焦并放大查看
   - 点击空白：取消选择

### 知识图谱科学构建功能

#### 1. 知识抽取

从文本中自动提取知识点和关系：

**API调用**：
```bash
POST /api/extract-knowledge
Content-Type: application/json

{
  "text": "运算放大器是一种高增益的差分放大器，常用于信号放大"
}
```

#### 2. 关系预测

预测两个实体之间可能存在的关系：

**API调用**：
```bash
GET /api/predict-relation/2/3
```

#### 3. 发现缺失链接

自动发现知识图谱中可能缺失的关联：

**API调用**：
```bash
GET /api/find-missing-links?threshold=0.3&max=20
```

#### 4. 相关概念推荐

基于向量相似度推荐相关概念：

**API调用**：
```bash
GET /api/recommend-related/2?top_k=10
```

## 📚 知识图谱内容

系统包含以下课程的知识点（120+节点，200+关系）：

- **电路基础**（ID: 1-99）：欧姆定律、基尔霍夫定律、戴维南定理、交流电路、动态电路、磁路、频域分析等
- **模拟电子技术**（ID: 100-199）：二极管、三极管、运放、放大电路、反馈电路、滤波器、振荡器等
- **数字电子技术**（ID: 200-299）：逻辑门、布尔代数、组合逻辑、时序逻辑、存储器、ADC/DAC等
- **高频电子线路**（ID: 300-399）：谐振电路、高频放大器、混频器、调制解调、锁相环、天线等
- **嵌入式系统**（ID: 400-499）：微控制器、ARM架构、GPIO、中断系统、通信接口、RTOS等

## 🛠️ 技术栈

- **后端**：Flask 2.3.3 (Python)
- **前端**：HTML5 + CSS3 + JavaScript
- **可视化**：vis-network
- **机器学习**：PyTorch (TransE模型)
- **数据处理**：NumPy
- **环境管理**：Conda / pip

## 🔧 开发说明

### 添加新知识点

在 `data.py` 文件的 `get_knowledge_graph_data()` 函数中：

1. **添加节点**：
```python
{
    'id': 新ID, 
    'label': '节点名称', 
    'group': '课程组',  # circuit/analog/digital/rf/embedded
    'title': '详细描述',
    'description': '完整描述',
    'difficulty': 难度等级(1-4),
    'learning_hours': 学习时长(小时),
    'prerequisites': [前置知识点ID列表],
    'formulas': ['公式1', '公式2'],
    'keywords': ['关键词1', '关键词2']
}
```

2. **添加关系**：
```python
{
    'from': 起始节点ID, 
    'to': 目标节点ID, 
    'label': '关系类型',  # 包含/基于/应用于/类型等
    'color': {'color': '#颜色代码'}
}
```

### 修改样式

编辑 `static/css/style.css` 文件来自定义界面样式。

### 修改交互逻辑

编辑 `static/js/main.js` 文件来自定义交互行为。

### 重新训练模型

如果修改了知识图谱数据，需要重新训练模型：

```bash
python train_model.py
```

## 📝 API 文档

### 基础API

- `GET /` - 主页面
- `GET /api/knowledge-graph` - 获取完整知识图谱数据
- `GET /api/node/<node_id>` - 获取特定节点信息
- `GET /api/learning-path/<start_id>/<end_id>` - 计算学习路径

### 科学构建API

- `POST /api/extract-knowledge` - 知识抽取
- `GET /api/predict-relation/<head_id>/<tail_id>` - 关系预测
- `GET /api/find-missing-links` - 发现缺失链接
- `GET /api/recommend-related/<entity_id>` - 相关概念推荐
- `GET /api/model-status` - 检查模型状态

详细API文档请参考代码注释。

## ⚠️ 注意事项

- 确保 Python 版本为 3.9 或更高
- 首次使用必须运行 `python train_model.py` 训练模型
- 如果端口 5000 被占用，可以在 `app.py` 中修改端口号
- 模型文件较大，已添加到 `.gitignore`，需要本地训练生成
- 建议使用虚拟环境隔离依赖

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [vis-network](https://visjs.github.io/vis-network/) - 知识图谱可视化
- [Flask](https://flask.palletsprojects.com/) - Web框架
- [PyTorch](https://pytorch.org/) - 深度学习框架

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [Issue](https://github.com/shy123-arch/Circuit-Knowledge-Graph-Visualization-System/issues)

---

**注意**：这是基础实现版本，适合快速展示和学习。如需更高准确率，需要进一步优化和训练。
