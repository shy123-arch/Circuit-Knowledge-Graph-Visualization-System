# Git 上传到 GitHub 详细步骤

本文档将指导您如何将项目上传到 GitHub。

## 📋 前置准备

1. **安装 Git**
   - Windows: 下载并安装 [Git for Windows](https://git-scm.com/download/win)
   - 安装完成后，打开 Git Bash 或 PowerShell

2. **注册 GitHub 账号**
   - 访问 [GitHub](https://github.com) 注册账号

3. **配置 Git（首次使用）**
   ```bash
   git config --global user.name "您的用户名"
   git config --global user.email "您的邮箱"
   ```

## 🚀 详细步骤

### 步骤 1: 在 GitHub 上创建仓库

1. 登录 GitHub
2. 点击右上角的 `+` 号，选择 `New repository`
3. 填写仓库信息：
   - **Repository name**: `knowledge-graph-visualization`（或您喜欢的名称）
   - **Description**: `电路类课程知识图谱可视化系统`
   - **Visibility**: 选择 `Public`（公开）或 `Private`（私有）
   - **不要**勾选 "Initialize this repository with a README"（因为本地已有文件）
4. 点击 `Create repository`

### 步骤 2: 初始化本地 Git 仓库

在项目根目录下打开终端（Git Bash 或 PowerShell），执行：

```bash
# 进入项目目录（如果不在项目目录）
cd "D:\文件\崇新学堂\信息基础2\信息基础\信息基础"

# 初始化 Git 仓库
git init
```

### 步骤 3: 添加文件到暂存区

```bash
# 查看当前状态
git status

# 添加所有文件（.gitignore 会自动排除不需要的文件）
git add .

# 或者逐个添加文件
git add README.md
git add app.py
git add data.py
# ... 等等
```

### 步骤 4: 提交更改

```bash
# 创建首次提交
git commit -m "Initial commit: 电路类课程知识图谱可视化系统"

# 或者更详细的提交信息
git commit -m "Initial commit

- 添加知识图谱可视化功能
- 实现知识抽取、嵌入、链接预测等功能
- 包含120+节点和200+关系
- 支持学习路径规划"
```

### 步骤 5: 连接到远程仓库

在 GitHub 上创建仓库后，会显示仓库地址，类似：
- HTTPS: `https://github.com/yourusername/knowledge-graph-visualization.git`
- SSH: `git@github.com:yourusername/knowledge-graph-visualization.git`

```bash
# 添加远程仓库（使用 HTTPS，推荐）
git remote add origin https://github.com/yourusername/knowledge-graph-visualization.git

# 或者使用 SSH（需要配置 SSH 密钥）
git remote add origin git@github.com:yourusername/knowledge-graph-visualization.git

# 查看远程仓库配置
git remote -v
```

### 步骤 6: 推送代码到 GitHub

```bash
# 推送代码到 main 分支（GitHub 默认分支）
git push -u origin main

# 如果您的默认分支是 master，使用：
git push -u origin master
```

**注意**：首次推送可能需要输入 GitHub 用户名和密码（或 Personal Access Token）

### 步骤 7: 验证上传

1. 刷新 GitHub 仓库页面
2. 应该能看到所有文件已经上传
3. README.md 会自动显示在仓库首页

## 🔄 后续更新代码

当您修改代码后，需要更新 GitHub：

```bash
# 1. 查看更改
git status

# 2. 添加更改的文件
git add .

# 3. 提交更改
git commit -m "更新说明：描述您做了什么更改"

# 4. 推送到 GitHub
git push
```

## 📝 常用 Git 命令

```bash
# 查看状态
git status

# 查看提交历史
git log

# 查看文件差异
git diff

# 撤销暂存的文件
git reset HEAD <文件名>

# 查看远程仓库
git remote -v

# 拉取远程更新
git pull

# 创建新分支
git checkout -b feature-branch

# 切换分支
git checkout main

# 合并分支
git merge feature-branch
```

## 🔐 身份验证

### 方法一：使用 Personal Access Token（推荐）

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 "Generate new token"
3. 选择权限：至少勾选 `repo`
4. 生成后复制 token（只显示一次）
5. 推送时使用 token 作为密码

### 方法二：使用 SSH 密钥

1. **生成 SSH 密钥**：
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# 按 Enter 使用默认路径，设置密码（可选）
```

2. **复制公钥**：
```bash
# Windows
cat ~/.ssh/id_ed25519.pub

# 或手动打开文件：C:\Users\您的用户名\.ssh\id_ed25519.pub
```

3. **添加到 GitHub**：
   - GitHub → Settings → SSH and GPG keys → New SSH key
   - 粘贴公钥内容，保存

4. **使用 SSH 地址**：
```bash
git remote set-url origin git@github.com:yourusername/knowledge-graph-visualization.git
```

## ⚠️ 常见问题

### 问题 1: 推送被拒绝

**错误**：`error: failed to push some refs`

**解决**：
```bash
# 先拉取远程更改
git pull origin main --allow-unrelated-histories

# 解决冲突后再次推送
git push
```

### 问题 2: 忘记添加 .gitignore

**解决**：
```bash
# 如果已经提交了不需要的文件，需要从 Git 中删除（但保留本地文件）
git rm --cached models/trained_model.pkl
git commit -m "Remove model file from git"
git push
```

### 问题 3: 修改远程仓库地址

```bash
# 查看当前远程地址
git remote -v

# 修改远程地址
git remote set-url origin https://github.com/newusername/new-repo.git
```

### 问题 4: 撤销最后一次提交

```bash
# 撤销提交但保留更改
git reset --soft HEAD~1

# 完全撤销提交和更改（谨慎使用）
git reset --hard HEAD~1
```

## 📚 更多资源

- [Git 官方文档](https://git-scm.com/doc)
- [GitHub 帮助文档](https://docs.github.com)
- [Git 教程 - 菜鸟教程](https://www.runoob.com/git/git-tutorial.html)

## ✅ 检查清单

上传前确认：

- [ ] 已创建 `.gitignore` 文件
- [ ] 已排除敏感信息（API密钥、密码等）
- [ ] 已排除大文件（模型文件等）
- [ ] README.md 已更新
- [ ] 代码已测试运行
- [ ] 提交信息清晰明确

---

**提示**：如果遇到问题，可以随时查看 Git 状态和日志来诊断问题。

