// 知识图谱可视化主程序

let network = null;
let allNodes = [];
let allEdges = [];
let selectedNodeId = null;
let nodesDataSet = null;
let edgesDataSet = null;
let allEdgesDataSet = null;  // 保存所有边的原始数据
let currentEdgeFilter = 'all';
let allNodesVisible = true;  // 标记是否显示所有节点
let filteredNodeIds = null;  // 当前可见的节点ID集合
let originalPhysicsOptions = null;  // 保存原始物理引擎参数

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadKnowledgeGraph();
    setupEventListeners();
});

// 加载知识图谱数据
async function loadKnowledgeGraph() {
    try {
        const loadingOverlay = document.querySelector('.graph-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
        }
        
        const response = await fetch('/api/knowledge-graph');
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data.nodes || !data.edges) {
            throw new Error('数据格式错误：缺少节点或边数据');
        }
        
        allNodes = data.nodes;
        allEdges = data.edges;
        
        // 更新统计信息
        updateStatistics();
        
        // 设置节点样式 - 使用更科学的颜色方案，根据level设置大小
        nodesDataSet = new vis.DataSet(allNodes.map(node => {
            const level = node.level || 0;
            const baseSize = level === 0 ? 18 : (level === 1 ? 16 : 14);
            const baseWidth = level === 0 ? 180 : (level === 1 ? 140 : 120);
            
            return {
                id: node.id,
                label: node.label,
                title: node.title,
                group: node.group,
                level: level,
                font: {
                    size: baseSize,
                    face: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
                    color: '#2c3e50',
                    bold: level <= 1
                },
                borderWidth: level === 0 ? 4 : 3,
                borderWidthSelected: level === 0 ? 5 : 4,
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.15)',
                    size: level === 0 ? 10 : 8,
                    x: 3,
                    y: 3
                },
                shape: 'box',
                widthConstraint: {
                    minimum: baseWidth - 20,
                    maximum: baseWidth + 40
                },
                heightConstraint: {
                    minimum: 35
                },
                margin: 12,
                color: {
                    border: level === 0 ? '#2c3e50' : '#34495e',
                    background: getNodeColor(node),
                    highlight: {
                        border: '#e74c3c',
                        background: '#fff5f5'
                    },
                    hover: {
                        border: '#3498db',
                        background: '#ebf5fb'
                    }
                }
            };
        }));
        
        // 保存所有边的原始数据
        allEdgesDataSet = new vis.DataSet(allEdges.map(edge => {
            const fromNode = allNodes.find(n => n.id === edge.from);
            const toNode = allNodes.find(n => n.id === edge.to);
            const isCrossCourse = fromNode && toNode && fromNode.group !== toNode.group;
            
            // 根据关系类型获取颜色
            const edgeColor = getEdgeColorByLabel(edge.label, isCrossCourse);
            
            // 跨课程关系更粗，内部关系较细
            const width = isCrossCourse ? 3 : 2;
            const opacity = isCrossCourse ? 0.9 : 0.7;
            
            return {
                from: edge.from,
                to: edge.to,
                label: edge.label,
                isCrossCourse: isCrossCourse,
                originalColor: edge.color,
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: isCrossCourse ? 1.0 : 0.8,
                        type: 'arrow'
                    }
                },
                color: {
                    color: edgeColor,
                    highlight: '#e74c3c',
                    opacity: opacity
                },
                font: {
                    size: isCrossCourse ? 12 : 10,
                    align: 'middle',
                    color: isCrossCourse ? '#c0392b' : '#7f8c8d',
                    face: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
                    bold: isCrossCourse
                },
                width: width,
                smooth: {
                    type: isCrossCourse ? 'curvedCW' : 'continuous',
                    roundness: isCrossCourse ? 0.5 : 0.4
                },
                selectionWidth: 5,
                dashes: false
            };
        }));
        
        // 设置边的样式 - 根据关系类型优化显示
        edgesDataSet = new vis.DataSet(allEdgesDataSet.get());
        
        // 创建网络图
        const container = document.getElementById('knowledge-graph');
        const networkData = { nodes: nodesDataSet, edges: edgesDataSet };
        
        const options = {
            nodes: {
                shape: 'box',
                font: {
                    size: 15,
                    face: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
                    color: '#2c3e50'
                },
                borderWidth: 3,
                borderWidthSelected: 5,
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.15)',
                    size: 8,
                    x: 3,
                    y: 3
                },
                color: {
                    border: '#34495e',
                    highlight: {
                        border: '#e74c3c',
                        background: '#fff5f5'
                    },
                    hover: {
                        border: '#3498db',
                        background: '#ebf5fb'
                    }
                },
                chosen: {
                    node: function(values, id, selected, hovering) {
                        if (hovering) {
                            values.shadow = true;
                            values.shadowSize = 12;
                        }
                    }
                }
            },
                edges: {
                width: 2.5,
                color: {
                    color: '#95a5a6',
                    highlight: '#e74c3c',
                    hover: '#3498db'
                },
                smooth: {
                    type: 'curvedCW',
                    roundness: 0.5
                },
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 0.9,
                        type: 'arrow'
                    }
                },
                font: {
                    size: 11,
                    align: 'middle',
                    color: '#7f8c8d',
                    face: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif'
                },
                selectionWidth: 5,
                chosen: {
                    edge: function(values, id, selected, hovering) {
                        if (hovering || selected) {
                            values.width = 4;
                        }
                    }
                }
            },
            physics: {
                enabled: true,
                stabilization: {
                    enabled: true,
                    iterations: 250,
                    fit: true,
                    updateInterval: 50
                },
                barnesHut: {
                    gravitationalConstant: -10000,
                    centralGravity: 0.03,
                    springLength: 400,
                    springConstant: 0.025,
                    damping: 0.45,
                    avoidOverlap: 4.0
                },
                maxVelocity: 45,
                minVelocity: 0.1,
                solver: 'barnesHut',
                timestep: 0.25
            },
            interaction: {
                hover: true,
                tooltipDelay: 150,
                zoomView: true,
                dragView: true,
                dragNodes: false,  // 禁用节点拖拽，只允许拖拽视图
                selectConnectedEdges: true,
                multiselect: false,
                navigationButtons: false,
                keyboard: {
                    enabled: true,
                    speed: { x: 10, y: 10, zoom: 0.02 }
                }
            },
            layout: {
                improvedLayout: true,
                hierarchical: {
                    enabled: false  // 使用力导向布局（Barnes-Hut算法）
                }
            },
            groups: {
                'circuit': {
                    shape: 'box',
                    color: { background: '#667eea', border: '#5568d3' }
                },
                'analog': {
                    shape: 'box',
                    color: { background: '#f093fb', border: '#d17ae8' }
                },
                'digital': {
                    shape: 'box',
                    color: { background: '#4facfe', border: '#3d8be8' }
                },
                'rf': {
                    shape: 'box',
                    color: { background: '#43e97b', border: '#2dd16a' }
                },
                'embedded': {
                    shape: 'box',
                    color: { background: '#fa709a', border: '#e85a7f' }
                }
            }
        };
        
        network = new vis.Network(container, networkData, options);
        
        // 标记是否已经禁用物理引擎，避免重复设置
        let physicsDisabled = false;
        
        // 禁用物理引擎的函数
        function disablePhysics() {
            if (!physicsDisabled) {
                physicsDisabled = true;
                network.setOptions({
                    physics: {
                        enabled: false
                    }
                });
            }
        }
        
        // 稳定化完成后，保存原始物理引擎参数并禁用物理引擎
        network.once('stabilizationEnd', function() {
            // 保存原始物理引擎参数
            originalPhysicsOptions = {
                gravitationalConstant: options.physics.barnesHut.gravitationalConstant,
                centralGravity: options.physics.barnesHut.centralGravity,
                springLength: options.physics.barnesHut.springLength,
                springConstant: options.physics.barnesHut.springConstant,
                damping: options.physics.barnesHut.damping,
                avoidOverlap: options.physics.barnesHut.avoidOverlap
            };
            
            disablePhysics();
            if (loadingOverlay) {
                setTimeout(() => {
                    loadingOverlay.classList.add('hidden');
                }, 300);
            }
        });
        
        // 备用方案：如果稳定化进度完成，也禁用物理引擎
        network.on('stabilizationProgress', function(params) {
            if (params.iterations >= params.total && !physicsDisabled) {
                // 确保保存了原始参数
                if (!originalPhysicsOptions) {
                    originalPhysicsOptions = {
                        gravitationalConstant: options.physics.barnesHut.gravitationalConstant,
                        centralGravity: options.physics.barnesHut.centralGravity,
                        springLength: options.physics.barnesHut.springLength,
                        springConstant: options.physics.barnesHut.springConstant,
                        damping: options.physics.barnesHut.damping,
                        avoidOverlap: options.physics.barnesHut.avoidOverlap
                    };
                }
                disablePhysics();
            }
        });
        
        // 最终备用方案：3秒后强制禁用物理引擎并隐藏加载动画
        setTimeout(function() {
            // 确保保存了原始参数
            if (!originalPhysicsOptions) {
                originalPhysicsOptions = {
                    gravitationalConstant: options.physics.barnesHut.gravitationalConstant,
                    centralGravity: options.physics.barnesHut.centralGravity,
                    springLength: options.physics.barnesHut.springLength,
                    springConstant: options.physics.barnesHut.springConstant,
                    damping: options.physics.barnesHut.damping,
                    avoidOverlap: options.physics.barnesHut.avoidOverlap
                };
            }
            disablePhysics();
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }, 3000);
        
        // 节点点击事件
        network.on('click', function(params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                showNodeInfo(nodeId);
                selectedNodeId = nodeId;
            } else {
                hideInfoPanel();
                selectedNodeId = null;
            }
        });
        
        // 双击事件 - 聚焦节点
        network.on('doubleClick', function(params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                network.focus(nodeId, {
                    scale: 1.8,
                    animation: {
                        duration: 1200,
                        easingFunction: 'easeInOutQuad'
                    }
                });
                showNodeInfo(nodeId);
            }
        });
        
        // 悬停事件
        network.on('hoverNode', function(params) {
            container.style.cursor = 'pointer';
        });
        
        network.on('blurNode', function(params) {
            container.style.cursor = 'default';
        });
        
    } catch (error) {
        console.error('加载知识图谱失败:', error);
        const loadingOverlay = document.querySelector('.graph-overlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div style="text-align: center;">
                    <p style="color: #e74c3c; font-size: 1.2em; margin-bottom: 10px;">
                        <i class="fas fa-exclamation-triangle"></i> 加载失败
                    </p>
                    <p style="color: #7f8c8d;">${error.message || '请检查服务器是否运行'}</p>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        重新加载
                    </button>
                </div>
            `;
        }
    }
}

// 根据节点组获取颜色 - 使用更科学的渐变色方案
function getNodeColor(node) {
    const colorMap = {
        'circuit': '#667eea',      // 蓝紫色 - 电路基础
        'analog': '#f093fb',       // 粉紫色 - 模拟电子
        'digital': '#4facfe',      // 蓝色 - 数字电子
        'rf': '#43e97b',           // 绿色 - 高频电子
        'embedded': '#fa709a'      // 粉红色 - 嵌入式
    };
    return colorMap[node.group] || '#bdc3c7';
}

// 根据关系类型获取边的颜色 - 每种关系使用不同颜色
function getEdgeColorByLabel(label, isCrossCourse) {
    // 关系类型到颜色的映射 - 每种关系都有独特的颜色
    const relationColorMap = {
        // 包含类关系 - 蓝色系（不同深浅）
        '包含': '#3498DB',
        '组成': '#2980B9',
        '构成': '#5DADE2',
        
        // 基础/依赖类关系 - 橙色系（不同深浅）
        '基础': '#E67E22',
        '基于': '#D35400',
        '应用于': '#F39C12',
        '应用': '#F5B041',
        
        // 扩展/发展类关系 - 绿色系（不同深浅）
        '扩展': '#27AE60',
        '扩展为': '#229954',
        '实现': '#52BE80',
        
        // 分析方法类 - 紫色系（不同深浅）
        '分析方法': '#9B59B6',
        '用于': '#8E44AD',
        '涉及': '#BB8FCE',
        
        // 类型/特征类 - 青色系（不同深浅）
        '类型': '#1ABC9C',
        '特征': '#16A085',
        '参数类型': '#48C9B0',
        '响应类型': '#76D7C4',
        '参数': '#2ECC71',
        '系列': '#58D68D',
        
        // 其他关系 - 不同色系
        '对应': '#95A5A6',
        '相关': '#7F8C8D',
        '连接': '#BDC3C7',
        '通信': '#566573',
        '集成': '#85929E',
        '变型': '#A6ACAF',
        '分析': '#707B7C',
        '配合': '#D5DBDB',
        '表示': '#CCD1D1',
        '算法': '#ABB2B9',
        '功能': '#99A3A4',
        '机制': '#839192',
        '使用': '#5D6D7E'
    };
    
    // 如果是跨课程关系，使用红色系
    if (isCrossCourse) {
        return '#E74C3C';  // 跨课程关系用红色
    }
    
    // 根据关系类型返回对应颜色，如果没有匹配则生成一个基于标签hash的颜色
    if (relationColorMap[label]) {
        return relationColorMap[label];
    }
    
    // 如果关系类型不在映射中，基于标签生成一个稳定的颜色
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
}

// 显示节点信息
async function showNodeInfo(nodeId) {
    try {
        const response = await fetch(`/api/node/${nodeId}`);
        const data = await response.json();
        
        if (data.error) {
            console.error('获取节点信息失败:', data.error);
            return;
        }
        
        const node = data.node;
        const relatedNodes = data.related_nodes;
        const relatedEdges = data.related_edges;
        
        // 构建信息面板内容
        let html = `
            <div class="node-info">
                <div class="node-title">${node.label}</div>
                <div class="node-description">${node.title || '暂无详细描述'}</div>
            </div>
        `;
        
        // 显示详细描述
        if (node.description) {
            html += `
                <div class="info-section">
                    <div class="info-section-title">
                        <i class="fas fa-info-circle"></i> 详细描述
                    </div>
                    <div class="info-section-content">${node.description}</div>
                </div>
            `;
        }
        
        // 显示难度和学习时长
        if (node.difficulty || node.learning_hours) {
            html += `
                <div class="info-section">
                    <div class="info-section-title">
                        <i class="fas fa-chart-line"></i> 学习信息
                    </div>
                    <div class="info-section-content">
                        <div class="info-row">
            `;
            if (node.difficulty) {
                const difficultyStars = '★'.repeat(node.difficulty) + '☆'.repeat(5 - node.difficulty);
                html += `
                            <div class="info-item">
                                <span class="info-label">难度:</span>
                                <span class="difficulty-stars" data-difficulty="${node.difficulty}">${difficultyStars}</span>
                            </div>
                `;
            }
            if (node.learning_hours) {
                html += `
                            <div class="info-item">
                                <span class="info-label">建议学习时长:</span>
                                <span class="info-value">${node.learning_hours} 小时</span>
                            </div>
                `;
            }
            html += `
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 显示前置知识点
        if (node.prerequisites && node.prerequisites.length > 0) {
            const prereqNodes = node.prerequisites.map(pid => allNodes.find(n => n.id === pid)).filter(n => n);
            if (prereqNodes.length > 0) {
                html += `
                    <div class="info-section">
                        <div class="info-section-title">
                            <i class="fas fa-arrow-up"></i> 前置知识点
                        </div>
                        <div class="info-section-content">
                            <div class="prerequisite-list">
                `;
                prereqNodes.forEach(prereq => {
                    html += `
                        <div class="prerequisite-item" onclick="focusNode(${prereq.id})">
                            <i class="fas fa-book"></i> ${prereq.label}
                        </div>
                    `;
                });
                html += `
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        // 显示相关公式
        if (node.formulas && node.formulas.length > 0) {
            html += `
                <div class="info-section">
                    <div class="info-section-title">
                        <i class="fas fa-calculator"></i> 相关公式
                    </div>
                    <div class="info-section-content">
                        <div class="formula-list">
            `;
            node.formulas.forEach(formula => {
                html += `
                    <div class="formula-item">
                        <code>${formula}</code>
                    </div>
                `;
            });
            html += `
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 显示关键词
        if (node.keywords && node.keywords.length > 0) {
            html += `
                <div class="info-section">
                    <div class="info-section-title">
                        <i class="fas fa-tags"></i> 关键词
                    </div>
                    <div class="info-section-content">
                        <div class="keyword-list">
            `;
            node.keywords.forEach(keyword => {
                html += `
                    <span class="keyword-tag">${keyword}</span>
                `;
            });
            html += `
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 显示示例
        if (node.examples && node.examples.length > 0) {
            html += `
                <div class="info-section">
                    <div class="info-section-title">
                        <i class="fas fa-lightbulb"></i> 应用示例
                    </div>
                    <div class="info-section-content">
                        <ul class="example-list">
            `;
            node.examples.forEach(example => {
                html += `
                    <li class="example-item">
                        <i class="fas fa-check-circle"></i> ${example}
                    </li>
                `;
            });
            html += `
                        </ul>
                    </div>
                </div>
            `;
        }
        
        // 显示关联节点
        if (relatedNodes.length > 0) {
            html += `
                <div class="related-section">
                    <div class="section-title">关联知识点 (${relatedNodes.length})</div>
                    <div class="related-nodes">
            `;
            
            relatedNodes.forEach(relatedNode => {
                html += `
                    <div class="related-node" onclick="focusNode(${relatedNode.id})">
                        <div class="related-node-title">${relatedNode.label}</div>
                        <div class="related-node-desc">${relatedNode.title || ''}</div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // 显示关联关系
        if (relatedEdges.length > 0) {
            html += `
                <div class="related-section">
                    <div class="section-title">关联关系 (${relatedEdges.length})</div>
                    <div class="related-edges">
            `;
            
            relatedEdges.forEach(edge => {
                const fromNode = allNodes.find(n => n.id === edge.from);
                const toNode = allNodes.find(n => n.id === edge.to);
                const direction = edge.from === nodeId ? '→' : '←';
                const otherNode = edge.from === nodeId ? toNode : fromNode;
                
                html += `
                    <div class="edge-item">
                        <span class="edge-label">${edge.label}</span>
                        ${direction} ${otherNode.label}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // 更新信息面板
        document.getElementById('info-content').innerHTML = html;
        document.getElementById('info-panel').classList.add('active');
        
        // 过滤节点，只显示相关节点（保持原始颜色）
        filterNodesBySelection(nodeId, relatedNodes.map(n => n.id));
        
    } catch (error) {
        console.error('获取节点信息失败:', error);
    }
}

// 高亮相关节点
function highlightRelatedNodes(centerNodeId, relatedNodeIds) {
    if (!network) return;
    
    // 获取所有节点和边
    const nodes = network.body.data.nodes;
    const edges = network.body.data.edges;
    
    // 重置所有节点和边的样式
    nodes.forEach(node => {
        node.color = {
            border: '#2B7CE9',
            background: getNodeColor(node),
            highlight: {
                border: '#FF6B6B',
                background: '#FFE5E5'
            }
        };
    });
    
    edges.forEach(edge => {
        edge.color = {
            color: '#848484',
            highlight: '#FF6B6B'
        };
    });
    
    // 高亮中心节点
    const centerNode = nodes.get(centerNodeId);
    if (centerNode) {
        centerNode.color = {
            border: '#FF6B6B',
            background: '#FFE5E5',
            highlight: {
                border: '#FF6B6B',
                background: '#FFE5E5'
            }
        };
    }
    
    // 高亮相关节点
    relatedNodeIds.forEach(nodeId => {
        const node = nodes.get(nodeId);
        if (node) {
            node.color = {
                border: '#FFB84D',
                background: '#FFF4E5',
                highlight: {
                    border: '#FF6B6B',
                    background: '#FFE5E5'
                }
            };
        }
    });
    
    // 高亮相关边
    edges.forEach(edge => {
        if ((edge.from === centerNodeId && relatedNodeIds.includes(edge.to)) ||
            (edge.to === centerNodeId && relatedNodeIds.includes(edge.from))) {
            edge.color = {
                color: '#FF6B6B',
                highlight: '#FF6B6B'
            };
        }
    });
    
    // 更新网络
    nodes.update(nodes.get());
    edges.update(edges.get());
}

// 聚焦到指定节点
function focusNode(nodeId) {
    if (!network) return;
    
    network.focus(nodeId, {
        scale: 1.5,
        animation: {
            duration: 1000,
            easingFunction: 'easeInOutQuad'
        }
    });
    
    // 显示节点信息
    showNodeInfo(nodeId);
}

// 过滤节点，只显示相关节点（保持原始颜色）
function filterNodesBySelection(centerNodeId, relatedNodeIds) {
    if (!network || !nodesDataSet || !edgesDataSet) return;
    
    // 构建要显示的节点ID集合（包括中心节点和相关节点）
    const visibleNodeIds = new Set([centerNodeId, ...relatedNodeIds]);
    filteredNodeIds = visibleNodeIds;
    allNodesVisible = false;
    
    // 更新节点可见性，并增大节点尺寸，恢复原始颜色
    const nodes = nodesDataSet.get();
    nodes.forEach(node => {
        const isVisible = visibleNodeIds.has(node.id);
        node.hidden = !isVisible;
        
        // 如果是可见节点，增大尺寸并恢复原始颜色
        if (isVisible) {
            const originalNode = allNodes.find(n => n.id === node.id);
            if (originalNode) {
                const level = originalNode.level || 0;
                
                // 增大节点尺寸（局部视图时）
                const baseSize = level === 0 ? 22 : (level === 1 ? 20 : 18);  // 字体增大
                const baseWidth = level === 0 ? 220 : (level === 1 ? 180 : 160);  // 宽度增大
                
                node.font = {
                    size: baseSize,
                    face: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
                    color: '#2c3e50',
                    bold: level <= 1
                };
                node.widthConstraint = {
                    minimum: baseWidth - 20,
                    maximum: baseWidth + 60
                };
                node.heightConstraint = {
                    minimum: 45  // 高度也增大
                };
                node.borderWidth = level === 0 ? 5 : 4;  // 边框更粗
                node.borderWidthSelected = level === 0 ? 6 : 5;
                node.margin = 16;  // 边距增大
                node.shadow = {
                    enabled: true,
                    color: 'rgba(0,0,0,0.2)',
                    size: level === 0 ? 12 : 10,
                    x: 4,
                    y: 4
                };
                
                node.color = {
                    border: originalNode.level === 0 ? '#2c3e50' : '#34495e',
                    background: getNodeColor(originalNode),
                    highlight: {
                        border: '#e74c3c',
                        background: '#fff5f5'
                    },
                    hover: {
                        border: '#3498db',
                        background: '#ebf5fb'
                    }
                };
            }
        }
    });
    nodesDataSet.update(nodes);
    
    // 更新边的可见性 - 只显示与中心节点相关的边
    const edges = edgesDataSet.get();
    edges.forEach(edge => {
        // 只显示连接中心节点的边（from或to是centerNodeId）
        const isRelatedEdge = edge.from === centerNodeId || edge.to === centerNodeId;
        const bothVisible = visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
        edge.hidden = !(isRelatedEdge && bothVisible);
        
        // 恢复边的原始颜色和样式，并增大相关边的标签字体
        if (!edge.hidden) {
            // 从原始边数据集中获取原始样式
            const originalEdgeData = allEdgesDataSet.get().find(e => 
                e.from === edge.from && e.to === edge.to
            );
            if (originalEdgeData) {
                // 恢复原始颜色，增大宽度和字体（局部视图优化）
                edge.color = originalEdgeData.color;
                edge.width = (originalEdgeData.width || 2) + 1.5;  // 线更粗，更容易看清
                // 增大相关边的标签字体
                const originalSize = originalEdgeData.font.size;
                edge.font = {
                    ...originalEdgeData.font,
                    size: originalSize + 8,  // 字体增大8px（从6px增加到8px）
                    bold: true  // 加粗
                };
                // 调整边的平滑度，让线更短更直
                edge.smooth = {
                    type: originalEdgeData.smooth?.type || 'continuous',
                    roundness: 0.2  // 减小弯曲度，让线更直更短
                };
            }
        }
    });
    edgesDataSet.update(edges);
    
    // 通过调整节点位置使相关节点更紧密，然后调整视图
    if (network) {
        // 获取中心节点位置
        const centerPos = network.getPositions([centerNodeId]);
        if (centerPos && centerPos[centerNodeId]) {
            const centerX = centerPos[centerNodeId].x;
            const centerY = centerPos[centerNodeId].y;
            
            // 获取所有可见节点的当前位置
            const positions = network.getPositions(Array.from(visibleNodeIds));
            
            // 计算缩放因子，让节点向中心收缩（距离减少到原来的60%，让节点更紧密，线更短）
            const shrinkFactor = 0.60;
            const nodesToUpdate = [];
            
            // 获取节点大小信息，用于计算最小距离
            const nodeSizeMap = {};
            const nodes = nodesDataSet.get();
            visibleNodeIds.forEach(nodeId => {
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                    // 估算节点大小（包括宽度和边距）- 局部视图时节点更大
                    const level = node.level || 0;
                    const baseWidth = level === 0 ? 220 : (level === 1 ? 180 : 160);  // 与上面的增大保持一致
                    const nodeWidth = baseWidth + 60;  // 加上边距（因为节点更大了）
                    const nodeHeight = 45 + 32;  // 高度加边距（节点更高了）
                    nodeSizeMap[nodeId] = {
                        width: nodeWidth,
                        height: nodeHeight,
                        radius: Math.max(nodeWidth, nodeHeight) / 2 + 50  // 增加最小距离，避免线重合（因为节点更大了）
                    };
                }
            });
            
            // 先收集所有相关节点，然后按角度排序，确保均匀分布
            const relatedNodes = [];
            visibleNodeIds.forEach(nodeId => {
                if (nodeId !== centerNodeId && positions[nodeId]) {
                    const dx = positions[nodeId].x - centerX;
                    const dy = positions[nodeId].y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx);
                    
                    relatedNodes.push({
                        id: nodeId,
                        dx: dx,
                        dy: dy,
                        distance: distance,
                        angle: angle
                    });
                }
            });
            
            // 按角度排序，使节点分布更均匀
            relatedNodes.sort((a, b) => a.angle - b.angle);
            
            // 计算每个节点的新位置，增加角度偏移避免连线重合
            relatedNodes.forEach((node, index) => {
                const nodeId = node.id;
                // 向中心收缩
                let newDistance = node.distance * shrinkFactor;
                
                // 确保最小距离，避免与中心节点重合（使用更大的最小距离因为节点更大了）
                const minDistance = (nodeSizeMap[centerNodeId]?.radius || 150) + (nodeSizeMap[nodeId]?.radius || 150) + 50;
                if (newDistance < minDistance) {
                    newDistance = minDistance;
                }
                
                // 优化角度分布，让节点更均匀分散，避免连线重合
                // 基于节点总数和索引，计算均匀的角度分布
                const totalNodes = relatedNodes.length;
                const idealAngleStep = (2 * Math.PI) / totalNodes;
                const idealAngle = index * idealAngleStep - Math.PI / 2;  // 从顶部开始
                // 更多地使用理想角度，让分布更均匀（50%的理想角度 + 50%的原始角度）
                const angleBlend = 0.5;  // 增加到50%，让节点分布更均匀
                const adjustedAngle = node.angle * (1 - angleBlend) + idealAngle * angleBlend;
                
                // 如果节点太多，可以稍微调整距离，让外层节点更分散
                if (totalNodes > 8) {
                    const layerOffset = Math.floor(index / 8) * 80;  // 每8个节点一层
                    newDistance += layerOffset;
                }
                
                const newX = centerX + Math.cos(adjustedAngle) * newDistance;
                const newY = centerY + Math.sin(adjustedAngle) * newDistance;
                
                nodesToUpdate.push({
                    id: nodeId,
                    x: newX,
                    y: newY
                });
            });
            
            // 检查并解决节点之间的重叠，同时优化布局减少线重叠
            const finalPositions = [];
            const processedPositions = new Map();
            
            // 获取边的连接关系，用于优化布局
            const edgeConnections = new Map();
            const allEdges = edgesDataSet.get();
            allEdges.forEach(edge => {
                if (!edge.hidden && visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)) {
                    if (!edgeConnections.has(edge.from)) {
                        edgeConnections.set(edge.from, []);
                    }
                    if (!edgeConnections.has(edge.to)) {
                        edgeConnections.set(edge.to, []);
                    }
                    edgeConnections.get(edge.from).push(edge.to);
                    edgeConnections.get(edge.to).push(edge.from);
                }
            });
            
            nodesToUpdate.forEach(nodeUpdate => {
                const nodeId = nodeUpdate.id;
                let finalX = nodeUpdate.x;
                let finalY = nodeUpdate.y;
                const nodeRadius = nodeSizeMap[nodeId]?.radius || 150;
                
                // 检查是否与其他已处理的节点重叠，并优化位置
                let overlap = true;
                let attempts = 0;
                while (overlap && attempts < 15) {
                    overlap = false;
                    
                    // 检查与中心节点的距离
                    const dxFromCenter = finalX - centerX;
                    const dyFromCenter = finalY - centerY;
                    const distFromCenter = Math.sqrt(dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter);
                    const centerRadius = nodeSizeMap[centerNodeId]?.radius || 150;
                    const minDistFromCenter = centerRadius + nodeRadius + 50;
                    
                    if (distFromCenter < minDistFromCenter) {
                        overlap = true;
                        const angle = Math.atan2(dyFromCenter, dxFromCenter);
                        finalX = centerX + Math.cos(angle) * minDistFromCenter;
                        finalY = centerY + Math.sin(angle) * minDistFromCenter;
                    }
                    
                    // 检查与其他节点的重叠
                    processedPositions.forEach((otherPos, otherId) => {
                        if (otherId === nodeId || otherId === centerNodeId) return;
                        
                        const dx = finalX - otherPos.x;
                        const dy = finalY - otherPos.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const otherRadius = nodeSizeMap[otherId]?.radius || 150;
                        const minDist = nodeRadius + otherRadius + 30;  // 增加间距，避免线重叠
                        
                        if (distance < minDist && distance > 0) {
                            overlap = true;
                            // 沿连线方向推开节点，并稍微调整角度避免线平行
                            const pushDistance = minDist - distance + 10;  // 额外间距
                            const angle = Math.atan2(dy, dx);
                            finalX += Math.cos(angle) * pushDistance * 1.2;
                            finalY += Math.sin(angle) * pushDistance * 1.2;
                            
                            // 如果两个节点都连接到中心节点，确保它们之间有足够的分离角度
                            const nodeConnections = edgeConnections.get(nodeId) || [];
                            const otherConnections = edgeConnections.get(otherId) || [];
                            if (nodeConnections.includes(centerNodeId) && otherConnections.includes(centerNodeId)) {
                                // 两个节点都连接到中心，确保角度差足够大
                                const nodeAngle = Math.atan2(finalY - centerY, finalX - centerX);
                                const otherAngle = Math.atan2(otherPos.y - centerY, otherPos.x - centerX);
                                let angleDiff = Math.abs(nodeAngle - otherAngle);
                                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                                
                                if (angleDiff < Math.PI / 6) {  // 如果角度差小于30度
                                    // 调整当前节点角度，使其与另一个节点分离
                                    const adjustment = (Math.PI / 6 - angleDiff) * 1.5;
                                    const newAngle = nodeAngle + (nodeAngle > otherAngle ? adjustment : -adjustment);
                                    const currentDist = Math.sqrt((finalX - centerX) ** 2 + (finalY - centerY) ** 2);
                                    finalX = centerX + Math.cos(newAngle) * currentDist;
                                    finalY = centerY + Math.sin(newAngle) * currentDist;
                                }
                            }
                        }
                    });
                    attempts++;
                }
                
                processedPositions.set(nodeId, { x: finalX, y: finalY });
                finalPositions.push({
                    id: nodeId,
                    x: finalX,
                    y: finalY
                });
            });
            
            // 更新节点位置
            if (finalPositions.length > 0) {
                nodesDataSet.update(finalPositions);
            }
        }
        
        // 调整视图，使相关节点填充视图
        setTimeout(() => {
            network.fit({
                nodes: Array.from(visibleNodeIds),
                animation: {
                    duration: 600,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }, 100);
    }
}

// 恢复显示所有节点
function showAllNodes() {
    if (!network || !nodesDataSet || !edgesDataSet || !allEdgesDataSet) return;
    
    allNodesVisible = true;
    filteredNodeIds = null;
    
    // 恢复所有节点的可见性、原始颜色和原始尺寸
    const nodes = nodesDataSet.get();
    nodes.forEach(node => {
        node.hidden = false;
        // 恢复原始颜色和尺寸
        const originalNode = allNodes.find(n => n.id === node.id);
        if (originalNode) {
            const level = originalNode.level || 0;
            // 恢复原始尺寸
            const baseSize = level === 0 ? 18 : (level === 1 ? 16 : 14);
            const baseWidth = level === 0 ? 180 : (level === 1 ? 140 : 120);
            
            node.font = {
                size: baseSize,
                face: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
                color: '#2c3e50',
                bold: level <= 1
            };
            node.widthConstraint = {
                minimum: baseWidth - 20,
                maximum: baseWidth + 40
            };
            node.heightConstraint = {
                minimum: 35
            };
            node.borderWidth = level === 0 ? 4 : 3;
            node.borderWidthSelected = level === 0 ? 5 : 4;
            node.margin = 12;
            node.shadow = {
                enabled: true,
                color: 'rgba(0,0,0,0.15)',
                size: level === 0 ? 10 : 8,
                x: 3,
                y: 3
            };
            
            node.color = {
                border: originalNode.level === 0 ? '#2c3e50' : '#34495e',
                background: getNodeColor(originalNode),
                highlight: {
                    border: '#e74c3c',
                    background: '#fff5f5'
                },
                hover: {
                    border: '#3498db',
                    background: '#ebf5fb'
                }
            };
        }
    });
    nodesDataSet.update(nodes);
    
    // 恢复所有边的可见性和原始样式（包括字体大小）
    const edges = edgesDataSet.get();
    const originalEdges = allEdgesDataSet.get();
    edges.forEach(edge => {
        edge.hidden = false;
        // 恢复原始样式
        const originalEdgeData = originalEdges.find(e => 
            e.from === edge.from && e.to === edge.to
        );
        if (originalEdgeData) {
            edge.color = originalEdgeData.color;
            edge.width = originalEdgeData.width;
            edge.font = originalEdgeData.font;  // 恢复原始字体大小
            edge.smooth = originalEdgeData.smooth;  // 恢复原始平滑度
        }
    });
    edgesDataSet.update(edges);
    
    // 恢复视图到全图显示，保持布局静止，不重新稳定化
    if (network) {
        network.fit({
            animation: {
                duration: 600,
                easingFunction: 'easeInOutQuad'
            }
        });
    }
}

// 隐藏信息面板
function hideInfoPanel() {
    document.getElementById('info-panel').classList.remove('active');
    
    // 恢复显示所有节点
    showAllNodes();
    
    // 重置高亮
    if (network && selectedNodeId) {
        const nodes = network.body.data.nodes;
        const edges = network.body.data.edges;
        
        nodes.forEach(node => {
            node.color = {
                border: '#2B7CE9',
                background: getNodeColor(node),
                highlight: {
                    border: '#FF6B6B',
                    background: '#FFE5E5'
                }
            };
        });
        
        edges.forEach(edge => {
            edge.color = {
                color: '#848484',
                highlight: '#FF6B6B'
            };
        });
        
        nodes.update(nodes.get());
        edges.update(edges.get());
    }
    
    selectedNodeId = null;
}

// 更新统计信息
function updateStatistics() {
    // 确保数据已加载
    if (!allNodes || !allEdges) {
        console.warn('统计数据更新失败：数据尚未加载');
        return;
    }
    
    // 更新节点和边数量
    const totalNodesEl = document.getElementById('total-nodes');
    const totalEdgesEl = document.getElementById('total-edges');
    if (totalNodesEl) totalNodesEl.textContent = allNodes.length || 0;
    if (totalEdgesEl) totalEdgesEl.textContent = allEdges.length || 0;
    
    // 按组统计节点数量
    const groupCounts = {};
    allNodes.forEach(node => {
        if (node && node.group) {
            groupCounts[node.group] = (groupCounts[node.group] || 0) + 1;
        }
    });
    
    // 更新图例计数
    const groupMap = {
        'circuit': 'count-circuit',
        'analog': 'count-analog',
        'digital': 'count-digital',
        'rf': 'count-rf',
        'embedded': 'count-embedded'
    };
    
    Object.keys(groupMap).forEach(group => {
        const countElement = document.getElementById(groupMap[group]);
        if (countElement) {
            countElement.textContent = groupCounts[group] || 0;
        }
    });
}

// 增强的搜索功能
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    const searchResultsDropdown = document.getElementById('search-results-dropdown');
    let searchTimeout = null;
    
    // 搜索节点（支持名称、标题、关键词、公式）
    function searchNodes(query) {
        if (!query || query.trim() === '') {
            return [];
        }
        
        const lowerQuery = query.toLowerCase();
        const results = [];
        
        allNodes.forEach(node => {
            let score = 0;
            let matchType = '';
            
            // 精确匹配节点名称
            if (node.label.toLowerCase() === lowerQuery) {
                score += 100;
                matchType = '精确匹配';
            }
            // 节点名称包含查询
            else if (node.label.toLowerCase().includes(lowerQuery)) {
                score += 50;
                matchType = '名称匹配';
            }
            // 标题匹配
            if (node.title && node.title.toLowerCase().includes(lowerQuery)) {
                score += 30;
                if (!matchType) matchType = '标题匹配';
            }
            // 关键词匹配
            if (node.keywords && node.keywords.length > 0) {
                const keywordMatch = node.keywords.some(kw => 
                    kw.toLowerCase().includes(lowerQuery)
                );
                if (keywordMatch) {
                    score += 20;
                    if (!matchType) matchType = '关键词匹配';
                }
            }
            // 公式匹配
            if (node.formulas && node.formulas.length > 0) {
                const formulaMatch = node.formulas.some(formula => 
                    formula.toLowerCase().includes(lowerQuery)
                );
                if (formulaMatch) {
                    score += 15;
                    if (!matchType) matchType = '公式匹配';
                }
            }
            // 描述匹配
            if (node.description && node.description.toLowerCase().includes(lowerQuery)) {
                score += 10;
                if (!matchType) matchType = '描述匹配';
            }
            
            if (score > 0) {
                results.push({
                    node: node,
                    score: score,
                    matchType: matchType
                });
            }
        });
        
        // 按分数排序
        results.sort((a, b) => b.score - a.score);
        return results;
    }
    
    // 显示搜索结果下拉
    function showSearchResults(query) {
        const results = searchNodes(query);
        
        if (results.length === 0) {
            searchResultsDropdown.style.display = 'none';
            highlightSearchResults([]);
            return;
        }
        
        // 构建下拉列表HTML
        let html = '';
        results.slice(0, 10).forEach((result, index) => {
            const node = result.node;
            const highlightedLabel = highlightText(node.label, query);
            const desc = node.title || node.description || '';
            const shortDesc = desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
            
            html += `
                <div class="search-result-item" data-node-id="${node.id}">
                    <div class="search-result-title">${highlightedLabel}</div>
                    <div class="search-result-desc">${shortDesc}</div>
                    <div class="search-result-desc" style="font-size: 0.8em; color: #999;">
                        <i class="fas fa-tag"></i> ${result.matchType}
                    </div>
                </div>
            `;
        });
        
        if (results.length > 10) {
            html += `<div class="search-result-count">还有 ${results.length - 10} 个结果，请缩小搜索范围</div>`;
        } else {
            html += `<div class="search-result-count">共找到 ${results.length} 个结果</div>`;
        }
        
        searchResultsDropdown.innerHTML = html;
        searchResultsDropdown.style.display = 'block';
        
        // 添加点击事件
        searchResultsDropdown.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                const nodeId = parseInt(this.dataset.nodeId);
                focusNode(nodeId);
                searchInput.value = '';
                searchResultsDropdown.style.display = 'none';
                clearSearch.style.display = 'none';
                resetSearch();
            });
        });
        
        // 高亮匹配的节点
        highlightSearchResults(results.map(r => r.node.id));
    }
    
    // 高亮文本中的匹配部分
    function highlightText(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="search-result-match">$1</span>');
    }
    
    // 输入事件（防抖）
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        
        if (query === '') {
            clearSearch.style.display = 'none';
            searchResultsDropdown.style.display = 'none';
            resetSearch();
            return;
        }
        
        clearSearch.style.display = 'block';
        
        // 防抖处理
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            showSearchResults(query);
        }, 200);
    });
    
    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        clearSearch.style.display = 'none';
        searchResultsDropdown.style.display = 'none';
        resetSearch();
        searchInput.focus();
    });
    
    // 回车键搜索第一个结果
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.trim();
            const results = searchNodes(query);
            
            if (results.length > 0) {
                focusNode(results[0].node.id);
                searchInput.value = '';
                searchResultsDropdown.style.display = 'none';
                clearSearch.style.display = 'none';
                resetSearch();
            }
        } else if (e.key === 'Escape') {
            searchResultsDropdown.style.display = 'none';
            searchInput.blur();
        }
    });
    
    // 点击外部关闭下拉
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResultsDropdown.contains(e.target)) {
            searchResultsDropdown.style.display = 'none';
        }
    });
    
    // Ctrl+F 快捷键聚焦搜索框
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
        }
    });
}

// 高亮搜索结果
function highlightSearchResults(nodeIds) {
    if (!network || !nodesDataSet) return;
    
    const nodes = nodesDataSet.get();
    nodes.forEach(node => {
        if (nodeIds.includes(node.id)) {
            node.color = {
                border: '#e74c3c',
                background: '#fff5f5',
                highlight: {
                    border: '#e74c3c',
                    background: '#fff5f5'
                }
            };
        } else {
            node.color = {
                border: '#34495e',
                background: getNodeColor(node),
                highlight: {
                    border: '#e74c3c',
                    background: '#fff5f5'
                }
            };
            node.opacity = 0.3;
        }
    });
    nodesDataSet.update(nodes);
}

// 重置搜索
function resetSearch() {
    if (!network || !nodesDataSet) return;
    
    const nodes = nodesDataSet.get();
    nodes.forEach(node => {
        node.color = {
            border: '#34495e',
            background: getNodeColor(node),
            highlight: {
                border: '#e74c3c',
                background: '#fff5f5'
            }
        };
        node.opacity = 1;
    });
    nodesDataSet.update(nodes);
}

// 设置事件监听器
function setupEventListeners() {
    // 关闭按钮
    document.getElementById('close-btn').addEventListener('click', function() {
        hideInfoPanel();
        if (network) {
            network.unselectAll();
        }
    });
    
    // 点击空白区域关闭面板
    const graphContainer = document.getElementById('knowledge-graph');
    if (graphContainer) {
        graphContainer.addEventListener('click', function(e) {
            if (e.target.id === 'knowledge-graph') {
                hideInfoPanel();
            }
        });
    }
    
    // 搜索功能
    setupSearch();
    
    // 学习路径规划功能
    setupLearningPath();
    
    // 重置视图
    document.getElementById('reset-view').addEventListener('click', function() {
        if (network) {
            // 恢复显示所有节点
            showAllNodes();
            network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
            hideInfoPanel();
            resetSearch();
            document.getElementById('search-input').value = '';
            document.getElementById('clear-search').style.display = 'none';
        }
    });
    
    // 适应窗口
    document.getElementById('fit-network').addEventListener('click', function() {
        if (network) {
            network.fit({
                animation: {
                    duration: 800,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    });
    
    // 重新布局：重新启用物理引擎稳定化，然后自动禁用
    document.getElementById('toggle-physics').addEventListener('click', function() {
        if (network) {
            // 重新启用物理引擎进行稳定化
            network.setOptions({
                physics: {
                    enabled: true,
                    stabilization: {
                        enabled: true,
                        iterations: 200,
                        fit: true
                    },
                    barnesHut: {
                        gravitationalConstant: -3500,
                        centralGravity: 0.15,
                        springLength: 180,
                        springConstant: 0.05,
                        damping: 0.35,
                        avoidOverlap: 1.5
                    }
                }
            });
            
            // 稳定化完成后再次禁用物理引擎
            network.once('stabilizationEnd', function() {
                network.setOptions({
                    physics: {
                        enabled: false
                    }
                });
            });
        }
    });
    
    // 图例点击事件 - 过滤显示
    document.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', function() {
            const group = this.dataset.group;
            if (group && nodesDataSet) {
                filterByGroup(group);
            }
        });
    });
}

// 按组过滤
let currentFilter = null;
function filterByGroup(group) {
    if (!network || !nodesDataSet) return;
    
    // 如果点击的是当前过滤的组，则取消过滤
    if (currentFilter === group) {
        currentFilter = null;
        resetSearch();
        return;
    }
    
    currentFilter = group;
    const nodes = nodesDataSet.get();
    nodes.forEach(node => {
        if (node.group === group) {
            node.opacity = 1;
            node.color = {
                border: '#34495e',
                background: getNodeColor(node),
                highlight: {
                    border: '#e74c3c',
                    background: '#fff5f5'
                }
            };
        } else {
            node.opacity = 0.2;
        }
    });
    nodesDataSet.update(nodes);
}

// 学习路径规划功能
function setupLearningPath() {
    const showPathBtn = document.getElementById('show-learning-path');
    const modal = document.getElementById('learning-path-modal');
    const closeModalBtn = document.getElementById('close-learning-path-modal');
    const pathStartInput = document.getElementById('path-start-input');
    const pathEndInput = document.getElementById('path-end-input');
    const pathStartResults = document.getElementById('path-start-results');
    const pathEndResults = document.getElementById('path-end-results');
    const calculateBtn = document.getElementById('calculate-path-btn');
    const pathResultSection = document.getElementById('path-result-section');
    const pathSteps = document.getElementById('path-steps');
    const pathInfo = document.getElementById('path-info');
    
    if (!showPathBtn || !modal) return; // 如果元素不存在，直接返回
    
    let selectedStartNode = null;
    let selectedEndNode = null;
    
    // 打开模态框
    showPathBtn.addEventListener('click', function() {
        modal.style.display = 'flex';
        if (pathStartInput) pathStartInput.focus();
    });
    
    // 关闭模态框
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            modal.style.display = 'none';
            resetPathInputs();
        });
    }
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            resetPathInputs();
        }
    });
    
    // ESC键关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            resetPathInputs();
        }
    });
    
    // 起始节点搜索
    if (pathStartInput && pathStartResults) {
        setupPathInputSearch(pathStartInput, pathStartResults, function(node) {
            selectedStartNode = node;
            pathStartInput.value = node.label;
            pathStartResults.style.display = 'none';
        });
    }
    
    // 目标节点搜索
    if (pathEndInput && pathEndResults) {
        setupPathInputSearch(pathEndInput, pathEndResults, function(node) {
            selectedEndNode = node;
            pathEndInput.value = node.label;
            pathEndResults.style.display = 'none';
        });
    }
    
    // 计算路径
    if (calculateBtn) {
        calculateBtn.addEventListener('click', async function() {
            if (!selectedStartNode || !selectedEndNode) {
                alert('请选择起始和目标知识点');
                return;
            }
            
            if (selectedStartNode.id === selectedEndNode.id) {
                alert('起始和目标知识点不能相同');
                return;
            }
            
            calculateBtn.disabled = true;
            calculateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 计算中...';
            
            try {
                const response = await fetch(`/api/learning-path/${selectedStartNode.id}/${selectedEndNode.id}`);
                const data = await response.json();
                
                if (data.error) {
                    alert(data.error);
                    return;
                }
                
                displayLearningPath(data.path, data.total_hours, data.total_difficulty);
            } catch (error) {
                console.error('计算学习路径失败:', error);
                alert('计算学习路径失败，请重试');
            } finally {
                calculateBtn.disabled = false;
                calculateBtn.innerHTML = '<i class="fas fa-calculator"></i> 计算路径';
            }
        });
    }
    
    function resetPathInputs() {
        if (pathStartInput) pathStartInput.value = '';
        if (pathEndInput) pathEndInput.value = '';
        selectedStartNode = null;
        selectedEndNode = null;
        if (pathStartResults) pathStartResults.style.display = 'none';
        if (pathEndResults) pathEndResults.style.display = 'none';
        if (pathResultSection) pathResultSection.style.display = 'none';
    }
    
    function setupPathInputSearch(input, resultsContainer, onSelect) {
        let searchTimeout = null;
        
        input.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            
            if (query === '') {
                resultsContainer.style.display = 'none';
                return;
            }
            
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const matchedNodes = searchNodesForPath(query);
                
                if (matchedNodes.length === 0) {
                    resultsContainer.innerHTML = '<div class="search-result-item">未找到匹配的知识点</div>';
                } else {
                    let html = '';
                    matchedNodes.slice(0, 8).forEach(result => {
                        const node = result.node;
                        html += `
                            <div class="search-result-item" data-node-id="${node.id}">
                                <div class="search-result-title">${node.label}</div>
                                <div class="search-result-desc">${node.title || ''}</div>
                            </div>
                        `;
                    });
                    resultsContainer.innerHTML = html;
                    
                    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', function() {
                            const nodeId = parseInt(this.dataset.nodeId);
                            const node = allNodes.find(n => n.id === nodeId);
                            if (node) {
                                onSelect(node);
                            }
                        });
                    });
                }
                
                resultsContainer.style.display = 'block';
            }, 200);
        });
        
        // 点击外部关闭
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        });
    }
    
    function searchNodesForPath(query) {
        const lowerQuery = query.toLowerCase();
        const results = [];
        
        allNodes.forEach(node => {
            let score = 0;
            
            if (node.label.toLowerCase() === lowerQuery) {
                score += 100;
            } else if (node.label.toLowerCase().includes(lowerQuery)) {
                score += 50;
            }
            if (node.title && node.title.toLowerCase().includes(lowerQuery)) {
                score += 30;
            }
            
            if (score > 0) {
                results.push({ node, score });
            }
        });
        
        results.sort((a, b) => b.score - a.score);
        return results;
    }
    
    function displayLearningPath(path, totalHours, totalDifficulty) {
        if (!pathResultSection || !pathSteps || !pathInfo) return;
        
        if (!path || path.length === 0) {
            pathSteps.innerHTML = '<div class="path-step">未找到学习路径</div>';
            pathResultSection.style.display = 'block';
            return;
        }
        
        let html = '';
        path.forEach((nodeId, index) => {
            const node = allNodes.find(n => n.id === nodeId);
            if (!node) return;
            
            html += `
                <div class="path-step" data-node-id="${node.id}">
                    <div class="path-step-number">${index + 1}</div>
                    <div class="path-step-content">
                        <div class="path-step-title">${node.label}</div>
                        <div class="path-step-desc">${node.title || node.description || ''}</div>
                    </div>
                    ${index < path.length - 1 ? '<div class="path-step-arrow"><i class="fas fa-arrow-down"></i></div>' : ''}
                </div>
            `;
        });
        
        pathSteps.innerHTML = html;
        
        // 计算总信息
        const avgDifficulty = path.length > 0 ? totalDifficulty / path.length : 0;
        const difficultyStars = '★'.repeat(Math.round(avgDifficulty)) + '☆'.repeat(5 - Math.round(avgDifficulty));
        
        pathInfo.innerHTML = `
            <div class="path-info-item">
                <span class="path-info-label">路径长度:</span>
                <span class="path-info-value">${path.length} 个知识点</span>
            </div>
            <div class="path-info-item">
                <span class="path-info-label">预计学习时长:</span>
                <span class="path-info-value">${totalHours} 小时</span>
            </div>
            <div class="path-info-item">
                <span class="path-info-label">平均难度:</span>
                <span class="path-info-value">${difficultyStars} (${avgDifficulty.toFixed(1)})</span>
            </div>
        `;
        
        pathResultSection.style.display = 'block';
        
        // 添加点击事件，点击步骤可以查看节点详情
        pathSteps.querySelectorAll('.path-step').forEach(step => {
            step.addEventListener('click', function() {
                const nodeId = parseInt(this.dataset.nodeId);
                focusNode(nodeId);
                showNodeInfo(nodeId);
                modal.style.display = 'none';
            });
        });
        
        // 高亮路径中的节点
        highlightPath(path);
    }
    
    function highlightPath(pathNodeIds) {
        if (!network || !nodesDataSet) return;
        
        const nodes = nodesDataSet.get();
        nodes.forEach(node => {
            if (pathNodeIds.includes(node.id)) {
                node.color = {
                    border: '#27ae60',
                    background: '#d5f4e6',
                    highlight: {
                        border: '#27ae60',
                        background: '#d5f4e6'
                    }
                };
                node.opacity = 1;
            } else {
                node.opacity = 0.2;
            }
        });
        nodesDataSet.update(nodes);
        
        // 聚焦到路径范围
        if (pathNodeIds.length > 0) {
            network.fit({
                nodes: pathNodeIds,
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    }
}

