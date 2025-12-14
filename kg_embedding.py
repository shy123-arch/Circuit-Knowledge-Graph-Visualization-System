"""
知识图谱嵌入模块 - TransE模型实现
使用TransE算法学习实体和关系的向量表示
"""

import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from typing import List, Dict, Tuple
import random
from collections import defaultdict

class TransE(nn.Module):
    """
    TransE模型：将实体和关系映射到向量空间
    核心思想：h + r ≈ t (头实体 + 关系 ≈ 尾实体)
    """
    
    def __init__(self, num_entities: int, num_relations: int, embedding_dim: int = 100):
        """
        初始化TransE模型
        
        Args:
            num_entities: 实体数量
            num_relations: 关系数量
            embedding_dim: 嵌入维度
        """
        super(TransE, self).__init__()
        self.num_entities = num_entities
        self.num_relations = num_relations
        self.embedding_dim = embedding_dim
        
        # 实体嵌入层（使用连续索引0到num_entities-1）
        self.entity_embedding = nn.Embedding(num_entities, embedding_dim)
        # 关系嵌入层
        self.relation_embedding = nn.Embedding(num_relations, embedding_dim)
        
        # 初始化嵌入向量（使用Xavier初始化）
        nn.init.xavier_uniform_(self.entity_embedding.weight.data)
        nn.init.xavier_uniform_(self.relation_embedding.weight.data)
        
        # 归一化关系嵌入
        self.relation_embedding.weight.data = nn.functional.normalize(
            self.relation_embedding.weight.data, p=2, dim=1
        )
    
    def forward(self, h: torch.Tensor, r: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        """
        计算三元组 (h, r, t) 的得分
        
        Args:
            h: 头实体索引
            r: 关系索引
            t: 尾实体索引
        
        Returns:
            得分（距离），越小越好
        """
        h_emb = self.entity_embedding(h)
        r_emb = self.relation_embedding(r)
        t_emb = self.entity_embedding(t)
        
        # TransE核心：计算 h + r - t 的L2范数
        score = torch.norm(h_emb + r_emb - t_emb, p=2, dim=1)
        return score
    
    def get_entity_embedding(self, entity_index: int) -> torch.Tensor:
        """
        获取实体的嵌入向量（使用连续索引）
        
        Args:
            entity_index: 实体的连续索引（0到num_entities-1）
        """
        if entity_index < 0 or entity_index >= self.num_entities:
            raise ValueError(f"实体索引 {entity_index} 超出范围 [0, {self.num_entities-1}]")
        return self.entity_embedding(torch.tensor([entity_index]))[0]
    
    def get_relation_embedding(self, relation_id: int) -> torch.Tensor:
        """获取关系的嵌入向量"""
        return self.relation_embedding(torch.tensor([relation_id]))[0]

def build_entity_mapping(nodes: List[Dict]) -> Tuple[Dict[int, int], Dict[int, int]]:
    """
    构建实体ID到连续索引的映射
    
    Args:
        nodes: 节点列表
    
    Returns:
        (entity_id_to_index, index_to_entity_id) 映射字典
    """
    entity_id_to_index = {}
    index_to_entity_id = {}
    
    for idx, node in enumerate(nodes):
        entity_id = node['id']
        entity_id_to_index[entity_id] = idx
        index_to_entity_id[idx] = entity_id
    
    return entity_id_to_index, index_to_entity_id

def prepare_training_data(
    edges: List[Dict], 
    relation_to_id: Dict[str, int],
    entity_id_to_index: Dict[int, int]
) -> List[Tuple[int, int, int]]:
    """
    准备训练数据：将边转换为三元组 (h, r, t)
    
    Args:
        edges: 边列表
        relation_to_id: 关系到ID的映射
        entity_id_to_index: 实体ID到索引的映射
    
    Returns:
        三元组列表（使用连续索引）
    """
    triples = []
    for edge in edges:
        h_id = edge['from']
        r_label = edge['label']
        t_id = edge['to']
        
        # 将实体ID映射到连续索引
        if h_id in entity_id_to_index and t_id in entity_id_to_index:
            h = entity_id_to_index[h_id]
            t = entity_id_to_index[t_id]
            
            if r_label in relation_to_id:
                r = relation_to_id[r_label]
                triples.append((h, r, t))
    
    return triples

def generate_negative_samples(triples: List[Tuple], num_entities: int, num_negatives: int = 1) -> List[Tuple]:
    """
    生成负样本（随机替换头或尾实体）
    
    Args:
        triples: 正样本三元组
        num_entities: 实体总数
        num_negatives: 每个正样本生成的负样本数
    
    Returns:
        负样本三元组列表
    """
    negative_triples = []
    positive_set = set(triples)
    
    for h, r, t in triples:
        for _ in range(num_negatives):
            # 随机决定替换头实体还是尾实体
            if random.random() < 0.5:
                # 替换头实体
                neg_h = random.randint(0, num_entities - 1)
                while (neg_h, r, t) in positive_set:
                    neg_h = random.randint(0, num_entities - 1)
                negative_triples.append((neg_h, r, t))
            else:
                # 替换尾实体
                neg_t = random.randint(0, num_entities - 1)
                while (h, r, neg_t) in positive_set:
                    neg_t = random.randint(0, num_entities - 1)
                negative_triples.append((h, r, neg_t))
    
    return negative_triples

def train_transE(
    model: TransE,
    triples: List[Tuple[int, int, int]],
    num_entities: int,
    epochs: int = 100,
    batch_size: int = 32,
    learning_rate: float = 0.01,
    margin: float = 1.0,
    entity_id_to_index: Dict[int, int] = None
) -> TransE:
    """
    训练TransE模型
    
    Args:
        model: TransE模型
        triples: 训练三元组
        num_entities: 实体数量
        epochs: 训练轮数
        batch_size: 批次大小
        learning_rate: 学习率
        margin: 间隔参数
    
    Returns:
        训练好的模型
    """
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    print(f"开始训练TransE模型...")
    print(f"训练数据: {len(triples)} 个三元组")
    print(f"实体数: {num_entities}, 关系数: {model.num_relations}")
    
    for epoch in range(epochs):
        total_loss = 0
        batch_count = 0
        
        # 打乱数据
        random.shuffle(triples)
        
        # 生成负样本
        negative_triples = generate_negative_samples(triples, num_entities, num_negatives=1)
        
        # 批次训练
        for i in range(0, len(triples), batch_size):
            batch_pos = triples[i:i+batch_size]
            batch_neg = negative_triples[i:i+batch_size]
            
            if len(batch_pos) == 0:
                continue
            
            # 准备批次数据
            h_pos = torch.tensor([t[0] for t in batch_pos])
            r_pos = torch.tensor([t[1] for t in batch_pos])
            t_pos = torch.tensor([t[2] for t in batch_pos])
            
            h_neg = torch.tensor([t[0] for t in batch_neg])
            r_neg = torch.tensor([t[1] for t in batch_neg])
            t_neg = torch.tensor([t[2] for t in batch_neg])
            
            # 计算正样本和负样本的得分
            pos_scores = model(h_pos, r_pos, t_pos)
            neg_scores = model(h_neg, r_neg, t_neg)
            
            # 计算损失（margin-based ranking loss）
            loss = torch.mean(torch.clamp(margin + pos_scores - neg_scores, min=0))
            
            # 反向传播
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            batch_count += 1
        
        # 归一化实体嵌入（保持L2范数为1）
        with torch.no_grad():
            norm = torch.norm(model.entity_embedding.weight.data, p=2, dim=1, keepdim=True)
            model.entity_embedding.weight.data = model.entity_embedding.weight.data / norm
        
        # 打印训练进度
        if (epoch + 1) % 10 == 0 or epoch == 0:
            avg_loss = total_loss / batch_count if batch_count > 0 else 0
            print(f"Epoch {epoch+1}/{epochs}, Average Loss: {avg_loss:.4f}")
    
    print("训练完成！")
    return model

def compute_entity_similarity(
    model: TransE, 
    entity1_index: int, 
    entity2_index: int
) -> float:
    """
    计算两个实体的相似度（余弦相似度）
    
    Args:
        model: 训练好的TransE模型
        entity1_index: 实体1的连续索引
        entity2_index: 实体2的连续索引
    
    Returns:
        相似度分数（0-1之间）
    """
    emb1 = model.get_entity_embedding(entity1_index)
    emb2 = model.get_entity_embedding(entity2_index)
    
    # 计算余弦相似度
    cosine_sim = torch.nn.functional.cosine_similarity(emb1.unsqueeze(0), emb2.unsqueeze(0))
    return cosine_sim.item()

# 测试函数
if __name__ == '__main__':
    from data import get_knowledge_graph_data
    
    # 加载知识图谱数据
    data = get_knowledge_graph_data()
    nodes = data['nodes']
    edges = data['edges']
    
    # 构建关系到ID的映射
    relation_labels = set(edge['label'] for edge in edges)
    relation_to_id = {label: idx for idx, label in enumerate(sorted(relation_labels))}
    id_to_relation = {idx: label for label, idx in relation_to_id.items()}
    
    print(f"关系类型: {len(relation_to_id)} 种")
    print(f"关系映射: {relation_to_id}")
    
    # 准备训练数据
    triples = prepare_training_data(edges, relation_to_id)
    print(f"训练三元组数量: {len(triples)}")
    
    # 创建模型
    num_entities = len(nodes)
    num_relations = len(relation_to_id)
    model = TransE(num_entities, num_relations, embedding_dim=50)
    
    # 训练模型（简化版：只训练50轮）
    trained_model = train_transE(model, triples, num_entities, epochs=50, batch_size=16)
    
    # 测试实体相似度
    print("\n实体相似度示例：")
    if len(nodes) >= 2:
        sim = compute_entity_similarity(trained_model, nodes[0]['id'], nodes[1]['id'])
        print(f"{nodes[0]['label']} 和 {nodes[1]['label']} 的相似度: {sim:.4f}")

