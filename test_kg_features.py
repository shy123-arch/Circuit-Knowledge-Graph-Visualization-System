"""
测试知识图谱科学构建功能
运行此脚本测试各个模块是否正常工作
"""

import sys

def test_extraction():
    """测试知识抽取模块"""
    print("=" * 60)
    print("测试1: 知识抽取模块")
    print("=" * 60)
    
    try:
        from kg_extraction import extract_from_text
        from data import get_knowledge_graph_data
        
        data = get_knowledge_graph_data()
        test_text = "运算放大器是一种高增益、直接耦合的差分放大器。基尔霍夫定律基于欧姆定律。"
        
        result = extract_from_text(test_text, data['nodes'])
        
        print(f"✓ 提取到 {result['entity_count']} 个实体")
        print(f"✓ 提取到 {result['relation_count']} 个关系")
        
        if result['entities']:
            print("\n提取的实体：")
            for entity in result['entities'][:3]:  # 只显示前3个
                print(f"  - {entity['name']} (置信度: {entity['confidence']:.2f})")
        
        if result['relations']:
            print("\n提取的关系：")
            for rel in result['relations'][:3]:  # 只显示前3个
                print(f"  - {rel['head']} --[{rel['relation']}]--> {rel['tail']}")
        
        print("\n✓ 知识抽取模块测试通过\n")
        return True
    except Exception as e:
        print(f"✗ 知识抽取模块测试失败: {e}\n")
        return False

def test_embedding():
    """测试知识图谱嵌入模块"""
    print("=" * 60)
    print("测试2: 知识图谱嵌入模块")
    print("=" * 60)
    
    try:
        from kg_embedding import TransE, prepare_training_data
        from data import get_knowledge_graph_data
        
        data = get_knowledge_graph_data()
        nodes = data['nodes']
        edges = data['edges']
        
        # 构建关系映射
        relation_labels = set(edge['label'] for edge in edges)
        relation_to_id = {label: idx for idx, label in enumerate(sorted(relation_labels))}
        
        # 准备训练数据
        triples = prepare_training_data(edges, relation_to_id)
        
        # 创建模型
        model = TransE(len(nodes), len(relation_to_id), embedding_dim=20)
        
        # 测试前向传播
        if len(triples) > 0:
            h = [triples[0][0]]
            r = [triples[0][1]]
            t = [triples[0][2]]
            
            import torch
            score = model(torch.tensor(h), torch.tensor(r), torch.tensor(t))
            print(f"✓ 模型创建成功")
            print(f"✓ 前向传播测试通过，得分: {score.item():.4f}")
            print(f"✓ 训练数据: {len(triples)} 个三元组")
        
        print("\n✓ 知识图谱嵌入模块测试通过\n")
        return True
    except Exception as e:
        print(f"✗ 知识图谱嵌入模块测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        return False

def test_completion():
    """测试知识图谱补全模块"""
    print("=" * 60)
    print("测试3: 知识图谱补全模块")
    print("=" * 60)
    
    try:
        from kg_completion import predict_relation
        from kg_embedding import TransE
        from data import get_knowledge_graph_data
        
        data = get_knowledge_graph_data()
        nodes = data['nodes']
        edges = data['edges']
        
        # 构建关系映射
        relation_labels = set(edge['label'] for edge in edges)
        relation_to_id = {label: idx for idx, label in enumerate(sorted(relation_labels))}
        id_to_relation = {idx: label for label, idx in relation_to_id.items()}
        
        # 创建简单模型（不训练，只测试接口）
        model = TransE(len(nodes), len(relation_to_id), embedding_dim=20)
        
        if len(nodes) >= 2:
            predictions = predict_relation(model, nodes[0]['id'], nodes[1]['id'], id_to_relation, top_k=3)
            print(f"✓ 链接预测功能正常")
            print(f"✓ 预测到 {len(predictions)} 个可能的关系")
            if predictions:
                print(f"  最可能的关系: {predictions[0]['relation']} (置信度: {predictions[0]['confidence']:.4f})")
        
        print("\n✓ 知识图谱补全模块测试通过\n")
        return True
    except Exception as e:
        print(f"✗ 知识图谱补全模块测试失败: {e}\n")
        import traceback
        traceback.print_exc()
        return False

def test_data_loading():
    """测试数据加载"""
    print("=" * 60)
    print("测试0: 数据加载")
    print("=" * 60)
    
    try:
        from data import get_knowledge_graph_data
        
        data = get_knowledge_graph_data()
        nodes = data['nodes']
        edges = data['edges']
        
        print(f"✓ 成功加载知识图谱数据")
        print(f"  - 节点数量: {len(nodes)}")
        print(f"  - 边数量: {len(edges)}")
        
        # 统计关系类型
        relation_types = set(edge['label'] for edge in edges)
        print(f"  - 关系类型: {len(relation_types)} 种")
        
        print("\n✓ 数据加载测试通过\n")
        return True
    except Exception as e:
        print(f"✗ 数据加载测试失败: {e}\n")
        return False

def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("知识图谱科学构建功能 - 测试脚本")
    print("=" * 60 + "\n")
    
    results = []
    
    # 测试数据加载
    results.append(("数据加载", test_data_loading()))
    
    # 测试各个模块
    results.append(("知识抽取", test_extraction()))
    results.append(("知识图谱嵌入", test_embedding()))
    results.append(("知识图谱补全", test_completion()))
    
    # 汇总结果
    print("=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\n总计: {passed} 个通过, {failed} 个失败")
    
    if failed == 0:
        print("\n🎉 所有测试通过！可以开始使用知识图谱科学构建功能了。")
        print("\n下一步：")
        print("  1. 运行 python train_model.py 训练模型")
        print("  2. 运行 python app.py 启动应用")
    else:
        print("\n⚠️  部分测试失败，请检查错误信息。")
        sys.exit(1)

if __name__ == '__main__':
    main()

