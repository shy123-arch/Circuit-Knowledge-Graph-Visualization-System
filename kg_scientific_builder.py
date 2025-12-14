"""
知识图谱科学构建模块
使用训练好的模型自动构建、补全和优化知识图谱
"""

import os
import pickle
import json
from typing import List, Dict, Tuple, Set
from data import get_knowledge_graph_data
from kg_embedding import TransE, build_entity_mapping
from kg_completion import predict_relation, find_missing_links, recommend_related_concepts

class KnowledgeGraphScientificBuilder:
    """
    知识图谱科学构建器
    使用训练好的模型自动构建、补全和优化知识图谱
    """
    
    def __init__(self, model_path: str = 'models/trained_model.pkl'):
        """
        初始化构建器
        
        Args:
            model_path: 训练好的模型路径
        """
        self.model_path = model_path
        self.model = None
        self.relation_to_id = None
        self.id_to_relation = None
        self.entity_id_to_index = None
        self.index_to_entity_id = None
        
        # 加载模型
        self.load_model()
        
        # 加载知识图谱数据
        self.kg_data = get_knowledge_graph_data()
        self.nodes = self.kg_data['nodes']
        self.edges = self.kg_data['edges']
    
    def load_model(self):
        """加载训练好的模型"""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"模型文件不存在: {self.model_path}。请先运行 train_model.py 训练模型。")
        
        with open(self.model_path, 'rb') as f:
            model_data = pickle.load(f)
            self.model = model_data['model']
            self.relation_to_id = model_data['relation_to_id']
            self.id_to_relation = model_data['id_to_relation']
            self.entity_id_to_index = model_data.get('entity_id_to_index')
            self.index_to_entity_id = model_data.get('index_to_entity_id')
        
        print(f"✓ 模型加载成功: {self.model_path}")
    
    def auto_complete_knowledge_graph(
        self, 
        confidence_threshold: float = 0.5,
        max_suggestions: int = 50,
        auto_accept: bool = False
    ) -> Dict:
        """
        自动补全知识图谱
        
        Args:
            confidence_threshold: 置信度阈值
            max_suggestions: 最大建议数量
            auto_accept: 是否自动接受高置信度的预测
        
        Returns:
            补全结果
        """
        print("\n" + "=" * 60)
        print("开始自动补全知识图谱...")
        print("=" * 60)
        
        # 发现缺失的链接
        missing_links = find_missing_links(
            self.model,
            self.nodes,
            self.edges,
            self.id_to_relation,
            self.entity_id_to_index,
            confidence_threshold=confidence_threshold,
            max_predictions=max_suggestions
        )
        
        print(f"\n发现 {len(missing_links)} 个可能缺失的链接")
        
        # 分类预测结果
        high_confidence = []  # 高置信度（>0.7）
        medium_confidence = []  # 中等置信度（0.5-0.7）
        low_confidence = []  # 低置信度（<0.5，但>=threshold）
        
        for link in missing_links:
            conf = link['confidence']
            if conf > 0.7:
                high_confidence.append(link)
            elif conf > 0.5:
                medium_confidence.append(link)
            else:
                low_confidence.append(link)
        
        print(f"  - 高置信度（>0.7）: {len(high_confidence)} 个")
        print(f"  - 中等置信度（0.5-0.7）: {len(medium_confidence)} 个")
        print(f"  - 低置信度（{confidence_threshold}-0.5）: {len(low_confidence)} 个")
        
        # 自动接受高置信度的预测
        accepted_links = []
        if auto_accept and high_confidence:
            print(f"\n自动接受 {len(high_confidence)} 个高置信度预测...")
            accepted_links = high_confidence.copy()
        
        # 生成建议列表
        suggestions = {
            'high_confidence': high_confidence,
            'medium_confidence': medium_confidence,
            'low_confidence': low_confidence,
            'accepted': accepted_links,
            'total_found': len(missing_links)
        }
        
        return suggestions
    
    def validate_existing_edges(self, threshold: float = 0.3) -> Dict:
        """
        验证现有边的正确性
        
        Args:
            threshold: 置信度阈值，低于此值的边可能需要检查
        
        Returns:
            验证结果
        """
        print("\n" + "=" * 60)
        print("验证现有边的正确性...")
        print("=" * 60)
        
        suspicious_edges = []
        validated_edges = []
        
        for edge in self.edges:
            head_id = edge['from']
            tail_id = edge['to']
            true_relation = edge['label']
            
            # 预测关系
            predictions = predict_relation(
                self.model,
                head_id,
                tail_id,
                self.id_to_relation,
                self.entity_id_to_index,
                top_k=3
            )
            
            if predictions:
                best_pred = predictions[0]
                predicted_relation = best_pred['relation']
                confidence = best_pred['confidence']
                
                # 如果预测的关系和现有关系不一致，或者置信度很低
                if predicted_relation != true_relation or confidence < threshold:
                    suspicious_edges.append({
                        'edge': edge,
                        'predicted_relation': predicted_relation,
                        'confidence': confidence,
                        'discrepancy': predicted_relation != true_relation
                    })
                else:
                    validated_edges.append({
                        'edge': edge,
                        'confidence': confidence
                    })
        
        print(f"\n验证完成:")
        print(f"  - 已验证正确的边: {len(validated_edges)} 个")
        print(f"  - 可疑的边: {len(suspicious_edges)} 个")
        
        return {
            'validated': validated_edges,
            'suspicious': suspicious_edges,
            'total_edges': len(self.edges)
        }
    
    def find_isolated_nodes(self) -> List[Dict]:
        """
        发现孤立节点（没有连接的节点）
        
        Returns:
            孤立节点列表
        """
        print("\n" + "=" * 60)
        print("发现孤立节点...")
        print("=" * 60)
        
        # 构建连接节点的集合
        connected_nodes = set()
        for edge in self.edges:
            connected_nodes.add(edge['from'])
            connected_nodes.add(edge['to'])
        
        # 找出孤立节点
        isolated_nodes = []
        for node in self.nodes:
            if node['id'] not in connected_nodes:
                isolated_nodes.append(node)
        
        print(f"发现 {len(isolated_nodes)} 个孤立节点")
        
        # 为孤立节点推荐连接
        recommendations = []
        for node in isolated_nodes:
            # 推荐相关概念
            related = recommend_related_concepts(
                self.model,
                node['id'],
                self.nodes,
                self.edges,
                self.entity_id_to_index,
                top_k=5
            )
            
            if related:
                recommendations.append({
                    'node': node,
                    'recommended_connections': related
                })
        
        return {
            'isolated_nodes': isolated_nodes,
            'recommendations': recommendations
        }
    
    def analyze_knowledge_structure(self) -> Dict:
        """
        分析知识图谱结构
        
        Returns:
            结构分析结果
        """
        print("\n" + "=" * 60)
        print("分析知识图谱结构...")
        print("=" * 60)
        
        # 统计信息
        stats = {
            'total_nodes': len(self.nodes),
            'total_edges': len(self.edges),
            'relation_types': len(self.relation_to_id),
            'avg_degree': 0,  # 平均度数
            'max_degree': 0,  # 最大度数
            'min_degree': 0,  # 最小度数
        }
        
        # 计算节点度数
        node_degrees = {}
        for node in self.nodes:
            node_degrees[node['id']] = 0
        
        for edge in self.edges:
            node_degrees[edge['from']] += 1
            node_degrees[edge['to']] += 1
        
        degrees = list(node_degrees.values())
        if degrees:
            stats['avg_degree'] = sum(degrees) / len(degrees)
            stats['max_degree'] = max(degrees)
            stats['min_degree'] = min(degrees)
        
        # 关系类型分布
        relation_distribution = {}
        for edge in self.edges:
            rel = edge['label']
            relation_distribution[rel] = relation_distribution.get(rel, 0) + 1
        
        # 课程分布
        course_distribution = {}
        for node in self.nodes:
            group = node.get('group', 'unknown')
            course_distribution[group] = course_distribution.get(group, 0) + 1
        
        print(f"\n结构统计:")
        print(f"  - 总节点数: {stats['total_nodes']}")
        print(f"  - 总边数: {stats['total_edges']}")
        print(f"  - 平均度数: {stats['avg_degree']:.2f}")
        print(f"  - 最大度数: {stats['max_degree']}")
        print(f"  - 最小度数: {stats['min_degree']}")
        
        return {
            'stats': stats,
            'relation_distribution': relation_distribution,
            'course_distribution': course_distribution,
            'node_degrees': node_degrees
        }
    
    def generate_completion_report(
        self,
        confidence_threshold: float = 0.5,
        output_file: str = 'kg_completion_report.json'
    ) -> Dict:
        """
        生成完整的补全报告
        
        Args:
            confidence_threshold: 置信度阈值
            output_file: 输出文件路径
        
        Returns:
            完整报告
        """
        print("\n" + "=" * 60)
        print("生成知识图谱补全报告...")
        print("=" * 60)
        
        # 1. 自动补全
        completion_result = self.auto_complete_knowledge_graph(
            confidence_threshold=confidence_threshold,
            max_suggestions=100
        )
        
        # 2. 验证现有边
        validation_result = self.validate_existing_edges(threshold=0.3)
        
        # 3. 发现孤立节点
        isolated_result = self.find_isolated_nodes()
        
        # 4. 结构分析
        structure_result = self.analyze_knowledge_structure()
        
        # 生成完整报告
        report = {
            'completion': completion_result,
            'validation': validation_result,
            'isolated_nodes': isolated_result,
            'structure': structure_result,
            'recommendations': self._generate_recommendations(
                completion_result,
                validation_result,
                isolated_result
            )
        }
        
        # 保存报告
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ 报告已保存到: {output_file}")
        
        return report
    
    def _generate_recommendations(
        self,
        completion_result: Dict,
        validation_result: Dict,
        isolated_result: Dict
    ) -> List[str]:
        """生成建议列表"""
        recommendations = []
        
        # 基于补全结果
        high_conf = len(completion_result['high_confidence'])
        if high_conf > 0:
            recommendations.append(
                f"建议添加 {high_conf} 个高置信度的关系（置信度>0.7）"
            )
        
        # 基于验证结果
        suspicious = len(validation_result['suspicious'])
        if suspicious > 0:
            recommendations.append(
                f"建议检查 {suspicious} 个可疑的关系，可能需要修正"
            )
        
        # 基于孤立节点
        isolated = len(isolated_result['isolated_nodes'])
        if isolated > 0:
            recommendations.append(
                f"发现 {isolated} 个孤立节点，建议添加连接"
            )
        
        return recommendations
    
    def apply_completions(
        self,
        accepted_links: List[Dict],
        output_file: str = 'data_enhanced.py'
    ):
        """
        应用补全结果到知识图谱
        
        Args:
            accepted_links: 接受的关系列表
            output_file: 输出文件路径
        """
        print("\n" + "=" * 60)
        print("应用补全结果到知识图谱...")
        print("=" * 60)
        
        # 构建新的边列表
        new_edges = self.edges.copy()
        
        # 添加新关系
        for link in accepted_links:
            new_edge = {
                'from': link['from'],
                'to': link['to'],
                'label': link['label'],
                'color': {'color': '#90EE90'}  # 浅绿色表示自动添加的
            }
            
            # 检查是否已存在
            exists = any(
                e['from'] == new_edge['from'] and 
                e['to'] == new_edge['to'] and 
                e['label'] == new_edge['label']
                for e in new_edges
            )
            
            if not exists:
                new_edges.append(new_edge)
                print(f"  + 添加: {link['from_label']} --[{link['label']}]--> {link['to_label']}")
        
        print(f"\n✓ 共添加 {len(new_edges) - len(self.edges)} 个新关系")
        print(f"  - 原有关系: {len(self.edges)} 个")
        print(f"  - 新增关系: {len(new_edges) - len(self.edges)} 个")
        print(f"  - 总关系数: {len(new_edges)} 个")
        
        # 注意：这里只是打印，实际修改data.py需要手动操作
        print(f"\n⚠️  注意：要实际更新知识图谱，需要手动修改 data.py 文件")
        print(f"   或者使用提供的建议列表手动添加关系")


def main():
    """主函数：科学构建知识图谱"""
    print("=" * 60)
    print("知识图谱科学构建工具")
    print("=" * 60)
    
    try:
        # 创建构建器
        builder = KnowledgeGraphScientificBuilder()
        
        # 生成完整报告
        report = builder.generate_completion_report(
            confidence_threshold=0.5,
            output_file='kg_completion_report.json'
        )
        
        # 显示建议
        print("\n" + "=" * 60)
        print("建议和下一步操作")
        print("=" * 60)
        
        if report['recommendations']:
            for i, rec in enumerate(report['recommendations'], 1):
                print(f"{i}. {rec}")
        
        # 询问是否应用高置信度的补全
        print("\n" + "-" * 60)
        high_conf_links = report['completion']['high_confidence']
        if high_conf_links:
            print(f"\n发现 {len(high_conf_links)} 个高置信度的关系（置信度>0.7）")
            print("前5个建议:")
            for i, link in enumerate(high_conf_links[:5], 1):
                print(f"  {i}. {link['from_label']} --[{link['label']}]--> {link['to_label']} (置信度: {link['confidence']:.3f})")
            
            response = input("\n是否应用这些高置信度的补全？(y/n): ")
            if response.lower() == 'y':
                builder.apply_completions(high_conf_links)
        
        print("\n" + "=" * 60)
        print("科学构建完成！")
        print("=" * 60)
        print("\n详细报告已保存到: kg_completion_report.json")
        print("你可以查看报告，决定哪些关系需要添加到知识图谱中。")
        
    except FileNotFoundError as e:
        print(f"\n❌ 错误: {e}")
        print("\n请先运行以下命令训练模型:")
        print("  python train_model.py")
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()

