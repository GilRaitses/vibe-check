#!/usr/bin/env python3
"""
NYC Safety App Presentation - Visualization Generator
Generates all charts, diagrams, and assets for the hackathon presentation
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import pandas as pd
import seaborn as sns
import yaml
import os
from pathlib import Path
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

# Load configuration
with open('data_config.yml', 'r') as f:
    config = yaml.safe_load(f)

# Create output directory
output_dir = Path(config['output']['folder'])
output_dir.mkdir(parents=True, exist_ok=True)

# Set matplotlib style
plt.style.use(config['output']['style'])
plt.rcParams['figure.figsize'] = config['output']['figsize']
plt.rcParams['figure.dpi'] = config['output']['dpi']

def save_figure(fig, filename, formats=['png', 'svg']):
    """Save figure in multiple formats"""
    for fmt in formats:
        filepath = output_dir / f"{filename}.{fmt}"
        fig.savefig(filepath, format=fmt, bbox_inches='tight', dpi=300)
        print(f"✅ Saved: {filepath}")

def create_performance_comparison():
    """Create before/after performance comparison chart"""
    perf = config['performance']
    
    metrics = ['API Calls', 'Analysis Time (s)', 'Success Rate (%)', 'Code Size (lines)']
    before_values = [perf['api_calls']['before'], 
                    perf['analysis_time']['before_seconds'],
                    perf['success_rate']['before_percent'],
                    perf['code_size']['before_lines']]
    after_values = [perf['api_calls']['after'],
                   perf['analysis_time']['after_seconds'], 
                   perf['success_rate']['after_percent'],
                   perf['code_size']['after_lines']]
    
    # Normalize values for better visualization
    normalized_before = [8/8, 60/60, 40/90, 1000/1000]  # Relative to max
    normalized_after = [1/8, 15/60, 90/90, 200/1000]
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(12, 8))
    
    # API Calls comparison
    ax1.bar(['Before', 'After'], [before_values[0], after_values[0]], 
            color=['#FF6B6B', '#4ECDC4'], alpha=0.8)
    ax1.set_title('API Calls per Analysis', fontsize=14, fontweight='bold')
    ax1.set_ylabel('Number of Calls')
    ax1.text(0, before_values[0]+0.2, f'{before_values[0]}', ha='center', fontweight='bold')
    ax1.text(1, after_values[0]+0.2, f'{after_values[0]}', ha='center', fontweight='bold')
    
    # Analysis Time comparison
    ax2.bar(['Before', 'After'], [before_values[1], after_values[1]], 
            color=['#FF6B6B', '#4ECDC4'], alpha=0.8)
    ax2.set_title('Analysis Time', fontsize=14, fontweight='bold')
    ax2.set_ylabel('Seconds')
    ax2.text(0, before_values[1]+2, f'{before_values[1]}s', ha='center', fontweight='bold')
    ax2.text(1, after_values[1]+2, f'{after_values[1]}s', ha='center', fontweight='bold')
    
    # Success Rate comparison
    ax3.bar(['Before', 'After'], [before_values[2], after_values[2]], 
            color=['#FF6B6B', '#4ECDC4'], alpha=0.8)
    ax3.set_title('Success Rate', fontsize=14, fontweight='bold')
    ax3.set_ylabel('Percentage')
    ax3.text(0, before_values[2]+2, f'{before_values[2]}%', ha='center', fontweight='bold')
    ax3.text(1, after_values[2]+2, f'{after_values[2]}%', ha='center', fontweight='bold')
    
    # Code Size comparison
    ax4.bar(['Before', 'After'], [before_values[3], after_values[3]], 
            color=['#FF6B6B', '#4ECDC4'], alpha=0.8)
    ax4.set_title('Code Size (MoondreamService)', fontsize=14, fontweight='bold')
    ax4.set_ylabel('Lines of Code')
    ax4.text(0, before_values[3]+30, f'{before_values[3]}', ha='center', fontweight='bold')
    ax4.text(1, after_values[3]+30, f'{after_values[3]}', ha='center', fontweight='bold')
    
    plt.suptitle('Performance Improvements: Before vs After Optimization', 
                 fontsize=16, fontweight='bold', y=0.98)
    plt.tight_layout()
    
    save_figure(fig, 'performance_comparison')
    plt.close()

def create_vision_variables_matrix():
    """Create visualization of the 25 vision variables"""
    variables = config['vision_variables']['categories']
    
    fig, ax = plt.subplots(figsize=(12, 8))
    
    y_pos = 0
    colors = []
    labels = []
    
    for category in variables:
        for i, position in enumerate(category['positions']):
            var_name = f"{category['name'].lower()}_{position}"
            labels.append(var_name)
            colors.append(category['color'])
            
            # Create rectangle for each variable
            rect = patches.Rectangle((i*2.5, y_pos), 2, 0.8, 
                                   facecolor=category['color'], alpha=0.7, edgecolor='black')
            ax.add_patch(rect)
            
            # Add text
            ax.text(i*2.5 + 1, y_pos + 0.4, position, 
                   ha='center', va='center', fontweight='bold', fontsize=8)
        
        # Category label
        ax.text(-1, y_pos + 0.4, category['name'], 
               ha='right', va='center', fontweight='bold', fontsize=12)
        
        y_pos += 1.2
    
    ax.set_xlim(-2, 12.5)
    ax.set_ylim(-0.5, y_pos)
    ax.set_title('25 Encoded Vision Variables (0-4 scale each)', 
                fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Position Categories', fontsize=12)
    ax.set_ylabel('Object Categories', fontsize=12)
    ax.axis('off')
    
    save_figure(fig, 'vision_variables_matrix')
    plt.close()

def create_architecture_diagram():
    """Create system architecture flow diagram"""
    components = config['architecture']['components']
    
    fig, ax = plt.subplots(figsize=(14, 8))
    
    # Define positions for components
    positions = {
        'Vision Config': (2, 8),
        'Moondream Service': (2, 6),
        'AsyncStorage': (8, 6),
        'Interpretation Service': (14, 6),
        'NYC Camera Service': (8, 3)
    }
    
    # Draw components
    for comp in components:
        name = comp['name']
        x, y = positions[name]
        
        # Component box
        rect = patches.FancyBboxPatch((x-1.5, y-0.8), 3, 1.6,
                                     boxstyle="round,pad=0.1",
                                     facecolor=comp['color'], alpha=0.7,
                                     edgecolor='black', linewidth=2)
        ax.add_patch(rect)
        
        # Component text
        ax.text(x, y+0.2, name, ha='center', va='center', 
               fontweight='bold', fontsize=10)
        ax.text(x, y-0.3, comp['responsibility'], ha='center', va='center', 
               fontsize=8, style='italic')
    
    # Draw arrows showing data flow
    arrows = [
        ((2, 7.2), (2, 6.8)),  # Config -> Moondream
        ((3.5, 6), (6.5, 6)),  # Moondream -> AsyncStorage
        ((9.5, 6), (12.5, 6)), # AsyncStorage -> Interpretation
        ((8, 5.2), (8, 3.8)),  # AsyncStorage -> NYC Camera
    ]
    
    for start, end in arrows:
        ax.annotate('', xy=end, xytext=start,
                   arrowprops=dict(arrowstyle='->', lw=2, color='#2C3E50'))
    
    # Add data flow labels
    ax.text(4.5, 6.3, 'Raw Encoded\nNumbers (0-4)', ha='center', va='bottom',
           bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
    ax.text(11, 6.3, 'Interpreted\nAnalysis', ha='center', va='bottom',
           bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
    ax.text(8.5, 4.5, 'Territory\nIntegration', ha='left', va='center',
           bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
    
    ax.set_xlim(0, 16)
    ax.set_ylim(1, 10)
    ax.set_title('Optimized System Architecture: Clean Data Flow', 
                fontsize=16, fontweight='bold', pad=20)
    ax.axis('off')
    
    save_figure(fig, 'architecture_diagram')
    plt.close()

def create_discovery_timeline():
    """Create timeline of discovery phases"""
    phases = config['discovery']['phases']
    
    fig, ax = plt.subplots(figsize=(14, 8))
    
    # Timeline setup - convert hours to relative positions
    total_hours = sum(phase['duration_hours'] for phase in phases)
    current_pos = 0
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
    
    for i, phase in enumerate(phases):
        duration = phase['duration_hours']
        width = duration / total_hours * 10  # Scale to fit nicely
        
        # Phase bar
        rect = patches.Rectangle((current_pos, 3), width, 1.5,
                               facecolor=colors[i], alpha=0.8, edgecolor='black', linewidth=2)
        ax.add_patch(rect)
        
        # Phase label
        ax.text(current_pos + width/2, 3.75, phase['phase'],
               ha='center', va='center', fontweight='bold', fontsize=11, wrap=True)
        
        # Description below
        ax.text(current_pos + width/2, 2.5, phase['description'],
               ha='center', va='top', fontsize=9, wrap=True)
        
        # Issues/improvements/features
        details = []
        if 'issues' in phase:
            details.extend(phase['issues'])
        if 'improvements' in phase:
            details.extend(phase['improvements'])
        if 'breakthrough' in phase:
            details.extend(phase['breakthrough'])
        if 'features' in phase:
            details.extend(phase['features'])
        
        detail_text = '\n'.join(f"• {detail}" for detail in details[:4])  # Show 4 items
        ax.text(current_pos + width/2, 1.8, detail_text,
               ha='center', va='top', fontsize=8)
        
        # Duration label
        ax.text(current_pos + width/2, 5, f'{duration}h',
               ha='center', va='center', fontweight='bold', fontsize=10,
               bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
        
        current_pos += width
    
    # Timeline axis
    ax.plot([0, 10], [3.75, 3.75], 'k-', linewidth=4)
    
    # Day markers
    day1_end = (8 + 4) / total_hours * 10  # After first two phases
    ax.axvline(x=day1_end, color='red', linestyle='--', linewidth=2, alpha=0.7)
    ax.text(day1_end/2, 5.8, 'June 21, 2025', ha='center', va='center', 
           fontweight='bold', fontsize=12, 
           bbox=dict(boxstyle="round,pad=0.5", facecolor='#FFE5E5'))
    ax.text((day1_end + 10)/2, 5.8, 'June 22, 2025', ha='center', va='center',
           fontweight='bold', fontsize=12,
           bbox=dict(boxstyle="round,pad=0.5", facecolor='#E5F5FF'))
    
    ax.set_xlim(-0.5, 10.5)
    ax.set_ylim(0, 6.5)
    ax.set_title('Development Timeline: 2-Day Hackathon Journey\nFrom Rate Limiting Crisis to Optimized System', 
                fontsize=18, fontweight='bold', pad=30)
    ax.axis('off')
    
    save_figure(fig, 'discovery_timeline')
    plt.close()

def create_mathematical_formulas():
    """Create visualization of mathematical formulas"""
    formulas = config['formulas']
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(20, 12))
    
    # Core metrics
    ax1.text(0.5, 0.9, 'Core Metrics', ha='center', va='top', 
            fontsize=16, fontweight='bold', transform=ax1.transAxes)
    
    y_pos = 0.8
    for formula in formulas['core_metrics']:
        ax1.text(0.05, y_pos, formula['name'], ha='left', va='top',
                fontsize=12, fontweight='bold', transform=ax1.transAxes)
        ax1.text(0.05, y_pos-0.05, formula['formula'], ha='left', va='top',
                fontsize=10, family='monospace', 
                bbox=dict(boxstyle="round,pad=0.3", facecolor='#E8F4FD'),
                transform=ax1.transAxes)
        ax1.text(0.05, y_pos-0.1, formula['description'], ha='left', va='top',
                fontsize=9, style='italic', transform=ax1.transAxes)
        y_pos -= 0.25
    
    # Multi-variable conditions
    ax2.text(0.5, 0.9, 'Multi-Variable Conditions', ha='center', va='top',
            fontsize=16, fontweight='bold', transform=ax2.transAxes)
    
    y_pos = 0.8
    for formula in formulas['multi_variable']:
        ax2.text(0.05, y_pos, formula['name'], ha='left', va='top',
                fontsize=12, fontweight='bold', transform=ax2.transAxes)
        ax2.text(0.05, y_pos-0.05, formula['formula'], ha='left', va='top',
                fontsize=10, family='monospace',
                bbox=dict(boxstyle="round,pad=0.3", facecolor='#FFF2E8'),
                transform=ax2.transAxes)
        ax2.text(0.05, y_pos-0.1, formula['description'], ha='left', va='top',
                fontsize=9, style='italic', transform=ax2.transAxes)
        y_pos -= 0.25
    
    ax1.axis('off')
    ax2.axis('off')
    
    plt.suptitle('Mathematical Scoring System', fontsize=18, fontweight='bold')
    
    save_figure(fig, 'mathematical_formulas')
    plt.close()

def create_limits_comparison():
    """Create before/after limits and improvements"""
    limits = config['limits']
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(20, 16))
    
    # Vision model caption issues
    issues = limits['vision_model']['caption_issues']
    y_pos = np.arange(len(issues))
    ax1.barh(y_pos, [1]*len(issues), color='#FF6B6B', alpha=0.7)
    ax1.set_yticks(y_pos)
    ax1.set_yticklabels(issues, fontsize=10)
    ax1.set_title('Vision Model Caption Issues', fontweight='bold')
    ax1.set_xlabel('Impact Level')
    
    # Improvements with encoding
    improvements = limits['vision_model']['improvements_with_encoding']
    y_pos = np.arange(len(improvements))
    ax2.barh(y_pos, [1]*len(improvements), color='#4ECDC4', alpha=0.7)
    ax2.set_yticks(y_pos)
    ax2.set_yticklabels(improvements, fontsize=10)
    ax2.set_title('Improvements with Encoding', fontweight='bold')
    ax2.set_xlabel('Benefit Level')
    
    # Original approach problems
    problems = limits['original_approach']['problems']
    y_pos = np.arange(len(problems))
    ax3.barh(y_pos, [1]*len(problems), color='#FF6B6B', alpha=0.7)
    ax3.set_yticks(y_pos)
    ax3.set_yticklabels(problems, fontsize=10)
    ax3.set_title('Original Approach Problems', fontweight='bold')
    ax3.set_xlabel('Severity')
    
    # Solutions implemented
    solutions = limits['original_approach']['solutions']
    y_pos = np.arange(len(solutions))
    ax4.barh(y_pos, [1]*len(solutions), color='#4ECDC4', alpha=0.7)
    ax4.set_yticks(y_pos)
    ax4.set_yticklabels(solutions, fontsize=10)
    ax4.set_title('Solutions Implemented', fontweight='bold')
    ax4.set_xlabel('Effectiveness')
    
    plt.suptitle('Challenges Discovered and Solutions Implemented', 
                 fontsize=16, fontweight='bold')
    plt.tight_layout()
    
    save_figure(fig, 'limits_comparison')
    plt.close()

def create_visual_states():
    """Create visual state management diagram"""
    states = config['visual_states']
    
    fig, ax = plt.subplots(figsize=(18, 10))
    
    # Create state flow diagram - 5 states now
    positions = [(2, 7), (6, 7), (10, 7), (14, 7), (8, 3)]
    
    for i, state in enumerate(states):
        x, y = positions[i]
        
        # State circle with actual alpha from config
        alpha_val = state.get('alpha', 0.8)
        circle = patches.Circle((x, y), 1.2, facecolor=state['hex_color'], 
                              alpha=alpha_val, edgecolor='black', linewidth=2)
        ax.add_patch(circle)
        
        # State text
        ax.text(x, y+0.3, state['state'], ha='center', va='center',
               fontweight='bold', fontsize=11)
        ax.text(x, y, state['description'], ha='center', va='center',
               fontsize=9, wrap=True)
        ax.text(x, y-0.3, f"α={alpha_val}", ha='center', va='center',
               fontsize=8, fontweight='bold', style='italic')
        ax.text(x, y-2, state['trigger'], ha='center', va='center',
               fontsize=8, style='italic', wrap=True)
    
    # Add arrows between states showing flow
    arrows = [
        ((3.2, 7), (4.8, 7)),    # Unprocessed -> Sakura
        ((7.2, 7), (8.8, 7)),    # Sakura -> Blinking  
        ((11.2, 7), (12.8, 7)),  # Blinking -> Heat
        ((10, 5.8), (8.5, 4.2)), # Blinking -> Error (alternative)
    ]
    
    for start, end in arrows:
        ax.annotate('', xy=end, xytext=start,
                   arrowprops=dict(arrowstyle='->', lw=2, color='#2C3E50'))
    
    # Add flow labels
    ax.text(4, 7.5, 'User enters\n500m radius', ha='center', va='bottom', fontsize=8,
           bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
    ax.text(8, 7.5, 'Processing\nstarts', ha='center', va='bottom', fontsize=8,
           bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
    ax.text(12.5, 7.5, 'Analysis\ncomplete', ha='center', va='bottom', fontsize=8,
           bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
    ax.text(9.2, 5, 'API\nfailure', ha='center', va='center', fontsize=8,
           bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
    
    ax.set_xlim(0, 16)
    ax.set_ylim(1, 9)
    ax.set_title('Real-Time Visual State Management\nWith Alpha Transparency Values', 
                fontsize=16, fontweight='bold', pad=20)
    ax.axis('off')
    
    save_figure(fig, 'visual_states')
    plt.close()

def main():
    """Generate all visualizations"""
    print("🎨 Generating visualizations for NYC Safety App presentation...")
    
    # Create all visualizations
    create_performance_comparison()
    create_vision_variables_matrix()
    create_architecture_diagram()
    create_discovery_timeline()
    create_mathematical_formulas()
    create_limits_comparison()
    create_visual_states()
    
    print(f"\n✅ All visualizations generated in {output_dir}")
    print("📊 Generated files:")
    for file in sorted(output_dir.glob("*")):
        print(f"   - {file.name}")

if __name__ == "__main__":
    main() 