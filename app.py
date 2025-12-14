from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from data import get_knowledge_graph_data
import os
import pickle

app = Flask(__name__)
CORS(app)

# 全局变量：存储训练好的模型
trained_model = None
relation_to_id = None
id_to_relation = None
entity_id_to_index = None
index_to_entity_id = None

@app.route('/')
def index():
    """主页面"""
    return render_template('index.html')

@app.route('/api/knowledge-graph')
def get_knowledge_graph():
    """获取知识图谱数据API"""
    data = get_knowledge_graph_data()
    return jsonify(data)

@app.route('/api/node/<int:node_id>')
def get_node_info(node_id):
    """获取特定节点的详细信息"""
    data = get_knowledge_graph_data()
    node = next((n for n in data['nodes'] if n['id'] == node_id), None)
    if node:
        # 获取与该节点相关的所有边
        related_edges = [e for e in data['edges'] if e['from'] == node_id or e['to'] == node_id]
        # 获取相关节点
        related_node_ids = set()
        for edge in related_edges:
            related_node_ids.add(edge['from'])
            related_node_ids.add(edge['to'])
        related_node_ids.discard(node_id)
        related_nodes = [n for n in data['nodes'] if n['id'] in related_node_ids]
        
        return jsonify({
            'node': node,
            'related_edges': related_edges,
            'related_nodes': related_nodes
        })
    return jsonify({'error': 'Node not found'}), 404

@app.route('/api/learning-path/<int:start_id>/<int:end_id>')
def get_learning_path(start_id, end_id):
    """计算从起始节点到目标节点的学习路径（基于prerequisites和关系）"""
    data = get_knowledge_graph_data()
    nodes = {n['id']: n for n in data['nodes']}
    edges = data['edges']
    
    # 构建有向图：prerequisites表示依赖关系，边表示连接关系
    graph = {}
    for node in nodes.values():
        graph[node['id']] = []
    
    # 1. 基于prerequisites构建依赖图
    # prerequisites表示：node需要先学习prereq
    # 所以路径应该是：prereq -> node
    for node in nodes.values():
        if 'prerequisites' in node and node['prerequisites']:
            for prereq_id in node['prerequisites']:
                if prereq_id in graph:
                    # prereq是前置，所以prereq -> node是学习路径方向
                    if node['id'] not in graph[prereq_id]:
                        graph[prereq_id].append(node['id'])
    
    # 2. 基于edges的关系构建图
    # 某些关系类型表示学习顺序，如"基于"、"包含"
    for edge in edges:
        from_id = edge['from']
        to_id = edge['to']
        label = edge['label']
        
        # "包含"关系：from包含to，所以先学to再学from
        # "基于"关系：to基于from，所以先学from再学to
        # "应用"关系：to应用from，所以先学from再学to
        if label in ['基于', '应用', '应用于']:
            if to_id in graph and from_id not in graph[to_id]:
                graph[to_id].append(from_id)
        elif label == '包含':
            if from_id in graph and to_id not in graph[from_id]:
                graph[from_id].append(to_id)
        else:
            # 其他关系双向连接
            if to_id in graph and from_id not in graph[to_id]:
                graph[to_id].append(from_id)
            if from_id in graph and to_id not in graph[from_id]:
                graph[from_id].append(to_id)
    
    # 使用BFS查找最短路径
    from collections import deque
    
    if start_id not in nodes or end_id not in nodes:
        return jsonify({'error': '节点不存在'}), 404
    
    if start_id == end_id:
        return jsonify({
            'path': [start_id],
            'total_hours': nodes[start_id].get('learning_hours', 0),
            'total_difficulty': nodes[start_id].get('difficulty', 0)
        })
    
    # BFS搜索最短路径
    queue = deque([(start_id, [start_id])])
    visited = {start_id}
    
    while queue:
        current, path = queue.popleft()
        
        if current == end_id:
            # 计算总学习时长和难度
            total_hours = sum(nodes[node_id].get('learning_hours', 0) for node_id in path)
            total_difficulty = sum(nodes[node_id].get('difficulty', 0) for node_id in path)
            
            return jsonify({
                'path': path,
                'total_hours': total_hours,
                'total_difficulty': total_difficulty
            })
        
        # 查找当前节点的所有可达节点
        if current in graph:
            for next_node in graph[current]:
                if next_node not in visited:
                    visited.add(next_node)
                    queue.append((next_node, path + [next_node]))
    
    # 如果找不到路径，返回错误
    return jsonify({
        'error': '未找到从起始节点到目标节点的学习路径。请尝试选择其他节点。',
        'path': [],
        'total_hours': 0,
        'total_difficulty': 0
    })

@app.route('/api/extract-knowledge', methods=['POST'])
def extract_knowledge():
    """从文本中提取知识（实体和关系）"""
    try:
        from kg_extraction import extract_from_text
        
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': '请提供文本内容'}), 400
        
        kg_data = get_knowledge_graph_data()
        result = extract_from_text(text, kg_data['nodes'])
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict-relation/<int:head_id>/<int:tail_id>')
def predict_relation_api(head_id, tail_id):
    """预测两个实体之间的关系"""
    try:
        from kg_completion import predict_relation
        
        if trained_model is None or entity_id_to_index is None:
            return jsonify({'error': '模型未训练，请先运行训练脚本'}), 400
        
        predictions = predict_relation(
            trained_model, head_id, tail_id, id_to_relation, 
            entity_id_to_index, top_k=5
        )
        
        return jsonify({
            'head_id': head_id,
            'tail_id': tail_id,
            'predictions': predictions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/find-missing-links')
def find_missing_links_api():
    """发现知识图谱中可能缺失的链接"""
    try:
        from kg_completion import find_missing_links
        
        if trained_model is None:
            return jsonify({'error': '模型未训练，请先运行训练脚本'}), 400
        
        confidence_threshold = float(request.args.get('threshold', 0.3))
        max_predictions = int(request.args.get('max', 20))
        
        if entity_id_to_index is None:
            return jsonify({'error': '模型未训练，请先运行训练脚本'}), 400
        
        kg_data = get_knowledge_graph_data()
        missing_links = find_missing_links(
            trained_model,
            kg_data['nodes'],
            kg_data['edges'],
            id_to_relation,
            entity_id_to_index,
            confidence_threshold=confidence_threshold,
            max_predictions=max_predictions
        )
        
        return jsonify({
            'missing_links': missing_links,
            'count': len(missing_links)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommend-related/<int:entity_id>')
def recommend_related_api(entity_id):
    """推荐与给定实体相关的概念"""
    try:
        from kg_completion import recommend_related_concepts
        
        if trained_model is None:
            return jsonify({'error': '模型未训练，请先运行训练脚本'}), 400
        
        top_k = int(request.args.get('top_k', 10))
        
        if entity_id_to_index is None:
            return jsonify({'error': '模型未训练，请先运行训练脚本'}), 400
        
        kg_data = get_knowledge_graph_data()
        recommendations = recommend_related_concepts(
            trained_model,
            entity_id,
            kg_data['nodes'],
            kg_data['edges'],
            entity_id_to_index,
            top_k=top_k
        )
        
        return jsonify({
            'entity_id': entity_id,
            'recommendations': recommendations
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/model-status')
def model_status():
    """检查模型状态"""
    return jsonify({
        'model_loaded': trained_model is not None,
        'model_path': 'models/trained_model.pkl' if os.path.exists('models/trained_model.pkl') else None
    })

def load_model():
    """加载训练好的模型"""
    global trained_model, relation_to_id, id_to_relation, entity_id_to_index, index_to_entity_id
    
    model_path = 'models/trained_model.pkl'
    if os.path.exists(model_path):
        try:
            with open(model_path, 'rb') as f:
                model_data = pickle.load(f)
                trained_model = model_data['model']
                relation_to_id = model_data['relation_to_id']
                id_to_relation = model_data['id_to_relation']
                entity_id_to_index = model_data.get('entity_id_to_index')
                index_to_entity_id = model_data.get('index_to_entity_id')
            print(f"模型加载成功: {model_path}")
        except Exception as e:
            print(f"模型加载失败: {e}")
    else:
        print("模型文件不存在，请先运行 train_model.py 训练模型")

# 启动时加载模型
load_model()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

