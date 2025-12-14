"""
知识图谱补全模块 - 链接预测
基于训练好的嵌入模型预测缺失的关系
"""

import torch
from typing import List, Dict, Tuple
from kg_embedding import TransE

def predict_relation(
    model: TransE,
    head_id: int,
    tail_id: int,
    id_to_relation: Dict[int, str],
    entity_id_to_index: Dict[int, int],
    top_k: int = 3
) -> List[Dict]:
    """
    预测两个实体之间最可能的关系
    
    Args:
        model: 训练好的TransE模型
        head_id: 头实体ID（原始ID）
        tail_id: 尾实体ID（原始ID）
        id_to_relation: 关系到ID的映射
        entity_id_to_index: 实体ID到索引的映射
        top_k: 返回前k个最可能的关系
    
    Returns:
        预测的关系列表（按置信度排序）
    """
    predictions = []
    
    # 将实体ID转换为连续索引
    if head_id not in entity_id_to_index or tail_id not in entity_id_to_index:
        return predictions
    
    head_index = entity_id_to_index[head_id]
    tail_index = entity_id_to_index[tail_id]
    
    h_emb = model.get_entity_embedding(head_index)
    t_emb = model.get_entity_embedding(tail_index)
    
    # 对每种关系计算得分
    for relation_id, relation_label in id_to_relation.items():
        r_emb = model.get_relation_embedding(relation_id)
        
        # 计算 h + r - t 的距离
        distance = torch.norm(h_emb + r_emb - t_emb, p=2).item()
        
        # 距离越小，置信度越高（转换为0-1之间的分数）
        confidence = 1.0 / (1.0 + distance)
        
        predictions.append({
            'relation': relation_label,
            'relation_id': relation_id,
            'confidence': confidence,
            'distance': distance
        })
    
    # 按置信度排序
    predictions.sort(key=lambda x: x['confidence'], reverse=True)
    
    return predictions[:top_k]

def find_missing_links(
    model: TransE,
    nodes: List[Dict],
    existing_edges: List[Dict],
    id_to_relation: Dict[int, str],
    entity_id_to_index: Dict[int, int],
    confidence_threshold: float = 0.5,
    max_predictions: int = 50
) -> List[Dict]:
    """
    发现知识图谱中可能缺失的链接
    
    Args:
        model: 训练好的TransE模型
        nodes: 节点列表
        existing_edges: 现有的边列表
        id_to_relation: 关系到ID的映射
        entity_id_to_index: 实体ID到索引的映射
        confidence_threshold: 置信度阈值
        max_predictions: 最大预测数量
    
    Returns:
        预测的新链接列表
    """
    # 构建现有边的集合（用于快速查找）
    existing_edge_set = set()
    for edge in existing_edges:
        existing_edge_set.add((edge['from'], edge['to']))
        existing_edge_set.add((edge['to'], edge['from']))  # 考虑双向
    
    predicted_links = []
    
    # 对所有可能的实体对进行预测
    for i, node1 in enumerate(nodes):
        for j, node2 in enumerate(nodes):
            if i >= j:  # 避免重复
                continue
            
            # 检查是否已存在边
            if (node1['id'], node2['id']) in existing_edge_set:
                continue
            
            # 预测关系
            predictions = predict_relation(
                model, node1['id'], node2['id'], id_to_relation, 
                entity_id_to_index, top_k=1
            )
            
            if predictions and predictions[0]['confidence'] >= confidence_threshold:
                best_pred = predictions[0]
                predicted_links.append({
                    'from': node1['id'],
                    'from_label': node1['label'],
                    'to': node2['id'],
                    'to_label': node2['label'],
                    'label': best_pred['relation'],
                    'confidence': best_pred['confidence'],
                    'distance': best_pred['distance']
                })
    
    # 按置信度排序
    predicted_links.sort(key=lambda x: x['confidence'], reverse=True)
    
    return predicted_links[:max_predictions]

def recommend_related_concepts(
    model: TransE,
    entity_id: int,
    nodes: List[Dict],
    existing_edges: List[Dict],
    entity_id_to_index: Dict[int, int],
    top_k: int = 10
) -> List[Dict]:
    """
    推荐与给定实体相关的概念
    
    Args:
        model: 训练好的TransE模型
        entity_id: 实体ID（原始ID）
        nodes: 节点列表
        existing_edges: 现有的边列表
        entity_id_to_index: 实体ID到索引的映射
        top_k: 返回前k个最相关的概念
    
    Returns:
        推荐的概念列表
    """
    # 将实体ID转换为连续索引
    if entity_id not in entity_id_to_index:
        return []
    
    entity_index = entity_id_to_index[entity_id]
    
    # 获取实体的嵌入
    entity_emb = model.get_entity_embedding(entity_index)
    
    # 计算与所有其他实体的相似度
    similarities = []
    for node in nodes:
        if node['id'] == entity_id:
            continue
        
        if node['id'] not in entity_id_to_index:
            continue
        
        other_index = entity_id_to_index[node['id']]
        other_emb = model.get_entity_embedding(other_index)
        similarity = torch.nn.functional.cosine_similarity(
            entity_emb.unsqueeze(0),
            other_emb.unsqueeze(0)
        ).item()
        
        similarities.append({
            'id': node['id'],
            'label': node['label'],
            'similarity': similarity
        })
    
    # 按相似度排序
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    
    return similarities[:top_k]

def evaluate_link_prediction(
    model: TransE,
    test_edges: List[Dict],
    relation_to_id: Dict[str, int],
    id_to_relation: Dict[int, str],
    entity_id_to_index: Dict[int, int],
    top_k: int = 10
) -> Dict:
    """
    评估链接预测的性能
    
    Args:
        model: 训练好的TransE模型
        test_edges: 测试边列表
        relation_to_id: 关系到ID的映射
        id_to_relation: ID到关系的映射
        entity_id_to_index: 实体ID到索引的映射
        top_k: Top-K评估
    
    Returns:
        评估结果
    """
    correct_top1 = 0
    correct_topk = 0
    total = len(test_edges)
    
    for edge in test_edges:
        head_id = edge['from']
        tail_id = edge['to']
        true_relation = edge['label']
        true_relation_id = relation_to_id.get(true_relation, -1)
        
        if true_relation_id == -1:
            continue
        
        # 预测关系
        predictions = predict_relation(
            model, head_id, tail_id, id_to_relation, entity_id_to_index, top_k=top_k
        )
        
        if predictions:
            # Top-1准确率
            if predictions[0]['relation'] == true_relation:
                correct_top1 += 1
            
            # Top-K准确率
            predicted_relations = [p['relation'] for p in predictions]
            if true_relation in predicted_relations:
                correct_topk += 1
    
    accuracy_top1 = correct_top1 / total if total > 0 else 0
    accuracy_topk = correct_topk / total if total > 0 else 0
    
    return {
        'total_test_edges': total,
        'correct_top1': correct_top1,
        'correct_topk': correct_topk,
        'accuracy_top1': accuracy_top1,
        'accuracy_topk': accuracy_topk
    }

# 测试函数
if __name__ == '__main__':
    from data import get_knowledge_graph_data
    from kg_embedding import train_transE, prepare_training_data, TransE
    
    from kg_embedding import build_entity_mapping, prepare_training_data, train_transE
    
    # 加载数据
    data = get_knowledge_graph_data()
    nodes = data['nodes']
    edges = data['edges']
    
    # 构建关系映射
    relation_labels = set(edge['label'] for edge in edges)
    relation_to_id = {label: idx for idx, label in enumerate(sorted(relation_labels))}
    id_to_relation = {idx: label for label, idx in relation_to_id.items()}
    
    # 构建实体ID映射
    entity_id_to_index, index_to_entity_id = build_entity_mapping(nodes)
    
    # 准备训练数据
    triples = prepare_training_data(edges, relation_to_id, entity_id_to_index)
    
    # 划分训练集和测试集（80%训练，20%测试）
    split_idx = int(len(triples) * 0.8)
    train_triples = triples[:split_idx]
    test_edges = edges[split_idx:]
    
    # 训练模型
    num_entities = len(nodes)
    num_relations = len(relation_to_id)
    model = TransE(num_entities, num_relations, embedding_dim=50)
    trained_model = train_transE(
        model, train_triples, num_entities, epochs=50, batch_size=16,
        entity_id_to_index=entity_id_to_index
    )
    
    # 测试链接预测
    print("\n链接预测示例：")
    if len(nodes) >= 2:
        predictions = predict_relation(
            trained_model, nodes[0]['id'], nodes[1]['id'], id_to_relation, 
            entity_id_to_index, top_k=3
        )
        print(f"预测 {nodes[0]['label']} 和 {nodes[1]['label']} 之间的关系：")
        for pred in predictions:
            print(f"  - {pred['relation']}: 置信度 {pred['confidence']:.4f}")
    
    # 发现缺失链接
    print("\n发现可能缺失的链接（前5个）：")
    missing_links = find_missing_links(
        trained_model, nodes, edges, id_to_relation, entity_id_to_index,
        confidence_threshold=0.3, max_predictions=5
    )
    for link in missing_links:
        print(f"  - {link['from_label']} --[{link['label']}]--> {link['to_label']} (置信度: {link['confidence']:.4f})")

