// 获取保存的语言设置
const savedLang = localStorage.getItem('selectedLanguage') || 'zh';

// 将 switchLanguage 函数设置为全局函数
window.switchLanguage = function(lang) {
    // 保存语言设置
    localStorage.setItem('selectedLanguage', lang);
    
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });

    // 更新下拉菜单中的选中状态
    document.querySelectorAll('.dropdown-content a').forEach(a => {
        const isCurrent = a.getAttribute('onclick').includes(`'${lang}'`);
        a.style.color = isCurrent ? 'var(--primary-color)' : 'var(--text-dark)';
        a.style.backgroundColor = isCurrent ? 'var(--bg-light)' : 'transparent';
    });

    // 更新 HTML lang 属性
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
}

// 等待 DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化语言
    switchLanguage(savedLang);

    // 导航栏活动状态切换逻辑 (Intersection Observer)
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('nav ul li a');

    const observerOptions = {
        threshold: 0.6
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));

    // Demo 原型演示逻辑
    const demoImage = document.getElementById('demo-image');
    const demoText = document.getElementById('demo-text');
    const demoRun = document.getElementById('demo-run');
    const demoClear = document.getElementById('demo-clear');
    const demoDownload = document.getElementById('demo-download');
    const demoOutput = document.getElementById('demo-output');
    const demoStatus = document.getElementById('demo-status');
    const fileUploadInfo = document.querySelector('.file-upload-info');

    function getLang() {
        return localStorage.getItem('selectedLanguage') || 'zh';
    }

    function t(key) {
        const lang = getLang();
        return (translations[lang] && translations[lang][key]) || key;
    }

    function summarizeFile(file) {
        if (!file) return null;
        return {
            name: file.name,
            type: file.type || 'unknown',
            size: (file.size / 1024).toFixed(2) + ' KB'
        };
    }

    // 文件上传预览效果
    demoImage.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            fileUploadInfo.textContent = `${t('demo_label_xray')}: ${file.name}`;
            fileUploadInfo.style.color = 'var(--primary-color)';
        } else {
            fileUploadInfo.textContent = t('demo_file_hint');
            fileUploadInfo.style.color = '';
        }
    });

    // 弹窗关闭逻辑
    const closeModal = () => {
        document.getElementById('result-modal').classList.add('hidden');
    };

    // 全局图片查看器逻辑
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX, startY;

    window.openImageViewer = function(src) {
        const viewer = document.getElementById('image-viewer');
        const fullImg = document.getElementById('full-image');
        fullImg.src = src;
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateImageTransform();
        viewer.classList.remove('hidden');
    };

    const updateImageTransform = () => {
        const fullImg = document.getElementById('full-image');
        fullImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    };

    const viewer = document.getElementById('image-viewer');
    viewer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = scale * delta;
        if (newScale >= 0.5 && newScale <= 10) {
            scale = newScale;
            updateImageTransform();
        }
    }, { passive: false });

    viewer.addEventListener('mousedown', (e) => {
        if (e.target.id === 'full-image') {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            updateImageTransform();
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    const closeImageViewer = () => {
        document.getElementById('image-viewer').classList.add('hidden');
    };

    document.getElementById('close-viewer').addEventListener('click', closeImageViewer);
    document.getElementById('image-viewer').addEventListener('click', (e) => {
        if (e.target.id === 'image-viewer') closeImageViewer();
    });

    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);

    // 点击弹窗背景关闭
    document.getElementById('result-modal').addEventListener('click', (e) => {
        if (e.target.id === 'result-modal') closeModal();
    });

    // 清空逻辑
    window.resetDemo = function() {
        demoImage.value = '';
        demoText.value = '';
        demoOutput.innerHTML = '';
        demoStatus.classList.add('hidden');
        demoDownload.disabled = true;
        fileUploadInfo.textContent = t('demo_file_hint');
        fileUploadInfo.style.color = '';
        window.__lastDemoReport = null;
        closeModal();
    }

    demoClear.addEventListener('click', resetDemo);

    // 运行诊断
    demoRun.addEventListener('click', async () => {
        const text = demoText.value.trim();
        const image = demoImage.files[0];

        if (!text && !image) {
            alert(t('demo_error_no_input'));
            return;
        }

        // 显示弹窗并开始加载
        const modal = document.getElementById('result-modal');
        modal.classList.remove('hidden');
        demoStatus.classList.remove('hidden');
        demoOutput.innerHTML = ''; 
        demoRun.disabled = true;
        demoDownload.disabled = true;

        try {
            const formData = new FormData();
            // 修复问题 1: 即使没有文字，也发送一个占位符，防止后端 422
            formData.append('history_text', text || "患者仅提供影像资料，无详细病史描述。");
            if (image) formData.append('file', image);
            
            // 补充诊断元数据
            formData.append('case_id', 'DDH-' + Date.now().toString(16).toUpperCase());
            formData.append('timestamp', new Date().toISOString());
            // 补全后端所需的必填字段
            formData.append('Ortolani', 'neg');
            formData.append('Barlow', 'neg');
            formData.append('abduction_deg', '0');

            const response = await fetch('http://47.109.39.6:8000/diagnose', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Backend Server Error');
            
            // 启用流式读取逻辑
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let analysisContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n--SEP--\n');
                buffer = parts.pop(); 

                for (const part of parts) {
                    if (!part.trim()) continue;
                    try {
                        const data = JSON.parse(part);
                        
                        if (data.type === 'metadata') {
                            const output = data.output;
                            const score = output.riskScore;
                            const level = score > 0.6 ? (getLang() === 'zh' ? "高风险" : "High Risk") : 
                                          score > 0.3 ? (getLang() === 'zh' ? "中风险" : "Medium Risk") : 
                                          (getLang() === 'zh' ? "低风险" : "Low Risk");
                            
                            const geometry = data.evidence?.medical_geometry || {};
                            const recommendation = score > 0.6 ? "建议尽快转诊至小儿骨科专家，进行 Graf 超声或 X 线复查。" : "建议定期随访，观察皮纹及关节活动情况。";

                            // 预渲染骨架
                            demoOutput.innerHTML = `
                                <div class="report-card">
                                    <div class="report-section-title"><i class="fas fa-poll"></i> 风险评估结果</div>
                                    <div class="risk-meter-container">
                                        <div class="risk-bar-bg"><div class="risk-bar-fill" style="width: ${score * 100}%"></div></div>
                                        <div class="risk-value-labels"><span>低</span><span>中</span><span>高</span></div>
                                    </div>
                                    <div class="result-grid">
                                        <div class="result-item"><div class="result-label">风险分值</div><div class="result-value" style="color: ${score > 0.6 ? '#ef4444' : score > 0.3 ? '#eab308' : '#22c55e'}">${(score * 100).toFixed(1)}%</div></div>
                                        <div class="result-item"><div class="result-label">风险等级</div><div class="result-value">${level}</div></div>
                                    </div>
                                </div>
                                ${geometry.acetabular_index ? `
                                <div class="report-card" style="border-left: 4px solid var(--accent-color);">
                                    <div class="report-section-title"><i class="fas fa-ruler-combined"></i> 医学几何测量参数 (AI 辅助)</div>
                                    <div class="result-grid">
                                        <div class="result-item"><div class="result-label">髋臼指数 (AI)</div><div class="result-value" style="color: var(--accent-color);">${geometry.acetabular_index}°</div></div>
                                        <div class="result-item"><div class="result-label">Perkin 方格判定</div><div class="result-value" style="font-size: 0.85rem;">${geometry.perkin_line}</div></div>
                                    </div>
                                    ${geometry.viz_image ? `
                                    <div style="margin-top: 1.5rem; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                                        <div style="font-size: 0.75rem; color: #94a3b8; padding: 0.5rem; background: rgba(255,255,255,0.05);">AI 辅助分析图 (线段标注)</div>
                                        <img src="${geometry.viz_image}" style="width: 100%; display: block; cursor: zoom-in;" onclick="openImageViewer('${geometry.viz_image}')">
                                    </div>
                                    ` : ''}
                                </div>
                                ` : ''}
                                <div class="report-card">
                                    <div class="report-section-title"><i class="fas fa-clipboard-check"></i> 临床建议</div>
                                    <div class="analysis-content" style="font-weight: 600; color: var(--accent-color);">${recommendation}</div>
                                </div>
                                <div class="report-card">
                                    <div class="report-section-title"><i class="fas fa-brain"></i> 多模态深度分析 (实时生成中...)</div>
                                    <div class="analysis-content" id="streaming-analysis"></div>
                                </div>
                            `;
                            
                            window.__lastDemoReport = {
                                header: { project: "Children's DDH AI Diagnosis System", timestamp: new Date().toLocaleString() },
                                result: { score, level, recommendation, analysis: "" }
                            };
                        } else if (data.type === 'content') {
                            analysisContent += data.content;
                            const analysisEl = document.getElementById('streaming-analysis');
                            if (analysisEl) {
                                analysisEl.textContent = analysisContent.replace(/\*\*/g, '');
                                analysisEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                            if (window.__lastDemoReport) window.__lastDemoReport.result.analysis = analysisContent;
                        }
                    } catch (e) { console.error("Parse error", e); }
                }
            }
            demoDownload.disabled = false;

        } catch (error) {
            console.error("Error:", error);
            const errorMsg = getLang() === 'zh' 
                ? "诊断请求失败。请检查：\n1. 服务器 (47.109.39.6) 是否在线\n2. 8000 端口是否开放\n3. 网络连接是否正常"
                : "Diagnosis failed. Please check:\n1. Server (47.109.39.6) status\n2. Port 8000 firewall\n3. Network connection";
            demoOutput.innerHTML = `<div class="placeholder-text" style="color: #ef4444;">${errorMsg}</div>`;
        } finally {
            demoStatus.classList.add('hidden');
            demoRun.disabled = false;
        }
    });

    // 下载报告
    demoDownload.addEventListener('click', () => {
        if (!window.__lastDemoReport) return;
        const blob = new Blob([JSON.stringify(window.__lastDemoReport, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DDH_Report_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });
});
