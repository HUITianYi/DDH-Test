# DDH-Test

本仓库用于保存儿童 DDH 辅助筛查与辅助诊疗原型的技术实现部分。

当前仓库只保留与项目实现直接相关的内容：

- Web 演示原型
- 后端参考服务
- 微信小程序原型
- 少量运行和展示所需静态资源

## 仓库结构

- `ddh-miniprogram/`  
  微信小程序原型代码与相关实现说明。

- `reference/`  
  后端参考服务与本地演示数据。

- `大创/`  
  Web 原型页面、后端实验代码及静态素材。

## 主要内容

### Web 原型

位于 `大创/`，核心文件包括：

- `index.html`
- `styles.css`
- `script.js`
- `translations.js`

用于完成原型演示、病例输入与结果展示。

### 后端参考服务

位于 `reference/`。

主要入口：

- `reference/main.py`

当前服务提供原型级 `/diagnose` 处理流程，涵盖：

- 图像预处理
- 视觉特征分析
- 结构化结果输出
- 流式文本返回

### 微信小程序

位于 `ddh-miniprogram/`。
<img width="430" height="430" alt="1f60fb1d610297b46817e221fd959646" src="https://github.com/user-attachments/assets/f7ea6073-ff7a-4012-bf80-b186c0dbe28b" />

主要页面包括：

- `pages/index/`
- `pages/case/`
- `pages/report/`
- `pages/history/`
- `pages/login/`
<img width="545" height="1158" alt="9246303b7ebad91783cacd1f02eee0ef" src="https://github.com/user-attachments/assets/9f58153b-6448-4e24-b54a-750fb493a91b" />
<img width="561" height="1165" alt="0e3f0fff3fa9156e9118dfa2563fece0" src="https://github.com/user-attachments/assets/c3b8720f-ffb0-4a91-a7ec-b0792fdd3008" />

当前已覆盖的体验路径包括：

- 主流程游客访问
- 病例录入与报告生成
- 历史记录访问
- 按需触发登录

## 使用方式

### 启动后端

在 `reference/` 目录下使用本地 Python 环境运行 FastAPI 服务。

依赖大致包括：

- Python
- FastAPI
- OpenAI SDK
- 图像处理与视觉分析相关依赖

### 打开微信小程序

在微信开发者工具中打开 `ddh-miniprogram/`。

相关配置文件：

- `project.config.json`
- `app.json`

### 查看 Web 演示

直接打开 `大创/` 下的静态页面文件，或部署到任意静态托管环境中进行展示。

## 说明

- 本仓库定位为技术原型仓库，不作为正式医疗产品使用。
- 仓库中保留中文目录名，是为了与原始开发工作区保持一致。
