"""
知识抽取模块 - 简单实现
使用规则和词典方法进行实体识别和关系抽取
"""

import re
from typing import List, Dict, Tuple

# 从现有知识图谱中提取实体词典
def build_entity_dict(nodes):
    """从现有节点构建实体词典"""
    entity_dict = {}
    for node in nodes:
        entity_dict[node['label']] = {
            'id': node['id'],
            'title': node.get('title', ''),
            'description': node.get('description', ''),
            'keywords': node.get('keywords', [])
        }
    return entity_dict

# 关系模式定义
RELATION_PATTERNS = {
    '包含': [
        r'(.+?)包含(.+?)',
        r'(.+?)包括(.+?)',
        r'(.+?)有(.+?)',
    ],
    '基于': [
        r'(.+?)基于(.+?)',
        r'(.+?)建立在(.+?)',
        r'(.+?)依赖于(.+?)',
    ],
    '应用': [
        r'(.+?)应用于(.+?)',
        r'(.+?)用于(.+?)',
        r'(.+?)可以(.+?)',
    ],
    '类型': [
        r'(.+?)是(.+?)的(.+?)',
        r'(.+?)属于(.+?)',
    ],
    '扩展': [
        r'(.+?)扩展为(.+?)',
        r'(.+?)发展为(.+?)',
    ]
}

def extract_entities(text: str, entity_dict: Dict) -> List[Dict]:
    """
    从文本中提取实体（简单规则方法）
    
    Args:
        text: 输入文本
        entity_dict: 实体词典
    
    Returns:
        提取到的实体列表
    """
    entities = []
    found_entities = set()
    
    # 方法1：精确匹配实体名称
    for entity_name, entity_info in entity_dict.items():
        if entity_name in text:
            if entity_name not in found_entities:
                entities.append({
                    'name': entity_name,
                    'id': entity_info['id'],
                    'type': 'exact_match',
                    'confidence': 0.9
                })
                found_entities.add(entity_name)
    
    # 方法2：关键词匹配
    for entity_name, entity_info in entity_dict.items():
        keywords = entity_info.get('keywords', [])
        for keyword in keywords:
            if keyword in text and entity_name not in found_entities:
                entities.append({
                    'name': entity_name,
                    'id': entity_info['id'],
                    'type': 'keyword_match',
                    'confidence': 0.6
                })
                found_entities.add(entity_name)
                break
    
    # 方法3：部分匹配（如果实体名称较长）
    for entity_name, entity_info in entity_dict.items():
        if len(entity_name) > 3:
            # 检查是否包含实体的主要部分
            parts = entity_name[:len(entity_name)//2]
            if parts in text and entity_name not in found_entities:
                entities.append({
                    'name': entity_name,
                    'id': entity_info['id'],
                    'type': 'partial_match',
                    'confidence': 0.4
                })
                found_entities.add(entity_name)
    
    return entities

def extract_relations(text: str, entity_dict: Dict) -> List[Dict]:
    """
    从文本中提取关系（基于规则模式匹配）
    
    Args:
        text: 输入文本
        entity_dict: 实体词典
    
    Returns:
        提取到的关系列表
    """
    relations = []
    
    # 提取文本中的实体
    entities = extract_entities(text, entity_dict)
    entity_names = [e['name'] for e in entities]
    
    if len(entity_names) < 2:
        return relations
    
    # 对每种关系类型进行模式匹配
    for relation_type, patterns in RELATION_PATTERNS.items():
        for pattern in patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                groups = match.groups()
                if len(groups) >= 2:
                    entity1 = groups[0].strip()
                    entity2 = groups[-1].strip()
                    
                    # 检查是否在实体词典中
                    if entity1 in entity_dict and entity2 in entity_dict:
                        relations.append({
                            'head': entity1,
                            'head_id': entity_dict[entity1]['id'],
                            'relation': relation_type,
                            'tail': entity2,
                            'tail_id': entity_dict[entity2]['id'],
                            'confidence': 0.7,
                            'source_text': match.group(0)
                        })
    
    # 如果模式匹配失败，尝试基于实体共现
    if len(relations) == 0 and len(entity_names) >= 2:
        # 简单的共现关系（置信度较低）
        for i in range(len(entity_names)):
            for j in range(i+1, len(entity_names)):
                relations.append({
                    'head': entity_names[i],
                    'head_id': entity_dict[entity_names[i]]['id'],
                    'relation': '相关',
                    'tail': entity_names[j],
                    'tail_id': entity_dict[entity_names[j]]['id'],
                    'confidence': 0.3,
                    'source_text': text
                })
    
    return relations

def extract_from_text(text: str, nodes: List[Dict]) -> Dict:
    """
    从文本中提取知识（实体+关系）
    
    Args:
        text: 输入文本
        nodes: 现有知识图谱节点
    
    Returns:
        提取结果
    """
    entity_dict = build_entity_dict(nodes)
    
    entities = extract_entities(text, entity_dict)
    relations = extract_relations(text, entity_dict)
    
    return {
        'entities': entities,
        'relations': relations,
        'entity_count': len(entities),
        'relation_count': len(relations)
    }

# 测试函数
if __name__ == '__main__':
    # 测试示例
    test_text = "运算放大器是一种高增益、直接耦合的差分放大器。基尔霍夫定律基于欧姆定律，包含电流定律和电压定律。滤波器应用于信号处理中。"
    
    # 需要从data.py导入节点数据
    from data import get_knowledge_graph_data
    data = get_knowledge_graph_data()
    nodes = data['nodes']
    
    result = extract_from_text(test_text, nodes)
    
    print("提取的实体：")
    for entity in result['entities']:
        print(f"  - {entity['name']} (ID: {entity['id']}, 置信度: {entity['confidence']:.2f})")
    
    print("\n提取的关系：")
    for relation in result['relations']:
        print(f"  - {relation['head']} --[{relation['relation']}]--> {relation['tail']} (置信度: {relation['confidence']:.2f})")

