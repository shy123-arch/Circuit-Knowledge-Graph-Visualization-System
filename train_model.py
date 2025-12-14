"""
训练知识图谱嵌入模型
运行此脚本训练TransE模型并保存
"""

import os
import pickle
from data import get_knowledge_graph_data
from kg_embedding import TransE, train_transE, prepare_training_data, build_entity_mapping

def main():
    print("=" * 60)
    print("知识图谱嵌入模型训练")
    print("=" * 60)
    
    # 1. 加载知识图谱数据
    print("\n1. 加载知识图谱数据...")
    data = get_knowledge_graph_data()
    nodes = data['nodes']
    edges = data['edges']
    
    print(f"   - 节点数量: {len(nodes)}")
    print(f"   - 边数量: {len(edges)}")
    
    # 2. 构建关系映射
    print("\n2. 构建关系映射...")
    relation_labels = set(edge['label'] for edge in edges)
    relation_to_id = {label: idx for idx, label in enumerate(sorted(relation_labels))}
    id_to_relation = {idx: label for label, idx in relation_to_id.items()}
    
    print(f"   - 关系类型数量: {len(relation_to_id)}")
    print(f"   - 关系类型: {list(relation_to_id.keys())}")
    
    # 3. 构建实体ID映射
    print("\n3. 构建实体ID映射...")
    entity_id_to_index, index_to_entity_id = build_entity_mapping(nodes)
    print(f"   - 实体ID映射完成（{len(entity_id_to_index)} 个实体）")
    
    # 4. 准备训练数据
    print("\n4. 准备训练数据...")
    triples = prepare_training_data(edges, relation_to_id, entity_id_to_index)
    print(f"   - 训练三元组数量: {len(triples)}")
    
    # 5. 创建模型
    print("\n5. 创建TransE模型...")
    num_entities = len(nodes)
    num_relations = len(relation_to_id)
    embedding_dim = 50  # 可以根据需要调整
    
    print(f"   - 实体数量: {num_entities}")
    print(f"   - 关系数量: {num_relations}")
    print(f"   - 嵌入维度: {embedding_dim}")
    
    model = TransE(num_entities, num_relations, embedding_dim=embedding_dim)
    
    # 6. 训练模型
    print("\n6. 开始训练模型...")
    print("   (这可能需要几分钟时间，请耐心等待)")
    
    trained_model = train_transE(
        model,
        triples,
        num_entities,
        epochs=100,  # 可以根据需要调整
        batch_size=32,
        learning_rate=0.01,
        margin=1.0,
        entity_id_to_index=entity_id_to_index
    )
    
    # 7. 保存模型
    print("\n7. 保存模型...")
    os.makedirs('models', exist_ok=True)
    model_path = 'models/trained_model.pkl'
    
    model_data = {
        'model': trained_model,
        'relation_to_id': relation_to_id,
        'id_to_relation': id_to_relation,
        'entity_id_to_index': entity_id_to_index,
        'index_to_entity_id': index_to_entity_id,
        'num_entities': num_entities,
        'num_relations': num_relations,
        'embedding_dim': embedding_dim
    }
    
    with open(model_path, 'wb') as f:
        pickle.dump(model_data, f)
    
    print(f"   - 模型已保存到: {model_path}")
    
    # 8. 测试模型
    print("\n8. 测试模型...")
    from kg_completion import predict_relation
    
    # 测试几个示例
    if len(nodes) >= 2:
        test_pairs = [
            (nodes[0]['id'], nodes[1]['id']),
            (nodes[0]['id'], nodes[min(2, len(nodes)-1)]['id']) if len(nodes) > 2 else None
        ]
        
        for head_id, tail_id in test_pairs:
            if head_id is None or tail_id is None:
                continue
            
            head_label = next(n['label'] for n in nodes if n['id'] == head_id)
            tail_label = next(n['label'] for n in nodes if n['id'] == tail_id)
            
            predictions = predict_relation(
                trained_model, head_id, tail_id, id_to_relation, 
                entity_id_to_index, top_k=3
            )
            
            print(f"\n   预测: {head_label} 和 {tail_label} 之间的关系")
            for pred in predictions:
                print(f"     - {pred['relation']}: 置信度 {pred['confidence']:.4f}")
    
    print("\n" + "=" * 60)
    print("训练完成！")
    print("=" * 60)
    print("\n现在可以启动Flask应用使用训练好的模型了：")
    print("  python app.py")

if __name__ == '__main__':
    main()

