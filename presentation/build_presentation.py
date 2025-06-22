#!/usr/bin/env python3
"""
Build script for NYC Safety App presentation
Generates visualizations and compiles presentation to multiple formats
"""

import subprocess
import sys
import os
from pathlib import Path
import shutil

def check_dependencies():
    """Check if required tools are installed"""
    required = ['python3', 'quarto', 'pandoc']
    missing = []
    
    for tool in required:
        try:
            subprocess.run([tool, '--version'], capture_output=True, check=True)
            print(f"✅ {tool} is installed")
        except (subprocess.CalledProcessError, FileNotFoundError):
            missing.append(tool)
            print(f"❌ {tool} is missing")
    
    if missing:
        print(f"\n⚠️  Please install missing dependencies: {', '.join(missing)}")
        print("Installation commands:")
        for tool in missing:
            if tool == 'quarto':
                print("  - Quarto: https://quarto.org/docs/get-started/")
            elif tool == 'pandoc':
                print("  - Pandoc: https://pandoc.org/installing.html")
        return False
    
    return True

def install_python_packages():
    """Install required Python packages"""
    packages = [
        'matplotlib',
        'seaborn', 
        'numpy',
        'pandas',
        'pyyaml',
        'plotly'
    ]
    
    print("📦 Installing Python packages...")
    for package in packages:
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install', package], 
                         capture_output=True, check=True)
            print(f"✅ Installed {package}")
        except subprocess.CalledProcessError:
            print(f"❌ Failed to install {package}")
            return False
    
    return True

def generate_visualizations():
    """Generate all visualizations"""
    print("🎨 Generating visualizations...")
    
    try:
        # Change to presentation directory
        os.chdir('presentation')
        
        # Run visualization generator
        result = subprocess.run([sys.executable, 'generate_visualizations.py'], 
                              capture_output=True, text=True, check=True)
        print(result.stdout)
        
        print("✅ Visualizations generated successfully")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to generate visualizations: {e}")
        print(f"Error output: {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ generate_visualizations.py not found")
        return False

def compile_presentation():
    """Compile presentation to multiple formats"""
    print("📄 Compiling presentation...")
    
    formats = [
        ('revealjs', 'HTML slides'),
        ('pdf', 'PDF document'),
        ('pptx', 'PowerPoint')
    ]
    
    success = True
    
    for format_name, description in formats:
        try:
            print(f"🔄 Generating {description}...")
            
            cmd = ['quarto', 'render', 'nyc_safety_presentation.qmd', 
                   '--to', format_name]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            print(f"✅ {description} generated successfully")
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to generate {description}: {e}")
            print(f"Error output: {e.stderr}")
            success = False
    
    return success

def create_output_structure():
    """Create organized output structure"""
    print("📁 Creating output structure...")
    
    # Create output directories
    output_dir = Path('output')
    output_dir.mkdir(exist_ok=True)
    
    (output_dir / 'slides').mkdir(exist_ok=True)
    (output_dir / 'assets').mkdir(exist_ok=True)
    (output_dir / 'documents').mkdir(exist_ok=True)
    
    # Copy generated files
    try:
        # Copy HTML slides
        if Path('nyc_safety_presentation.html').exists():
            shutil.copy('nyc_safety_presentation.html', output_dir / 'slides')
            print("✅ HTML slides copied")
        
        # Copy PDF
        if Path('nyc_safety_presentation.pdf').exists():
            shutil.copy('nyc_safety_presentation.pdf', output_dir / 'documents')
            print("✅ PDF document copied")
        
        # Copy PowerPoint
        if Path('nyc_safety_presentation.pptx').exists():
            shutil.copy('nyc_safety_presentation.pptx', output_dir / 'documents')
            print("✅ PowerPoint presentation copied")
        
        # Copy assets
        if Path('assets').exists():
            shutil.copytree('assets', output_dir / 'assets', dirs_exist_ok=True)
            print("✅ Assets copied")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to organize output: {e}")
        return False

def main():
    """Main build process"""
    print("🚀 Building NYC Safety App Presentation")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        return False
    
    # Install Python packages
    if not install_python_packages():
        return False
    
    # Generate visualizations
    if not generate_visualizations():
        return False
    
    # Compile presentation
    if not compile_presentation():
        return False
    
    # Create organized output
    if not create_output_structure():
        return False
    
    print("\n🎉 Build completed successfully!")
    print("\nGenerated files:")
    print("  📊 HTML Slides: output/slides/nyc_safety_presentation.html")
    print("  📄 PDF Document: output/documents/nyc_safety_presentation.pdf")
    print("  📈 PowerPoint: output/documents/nyc_safety_presentation.pptx")
    print("  🎨 Assets: output/assets/")
    
    print("\n🌐 To view the presentation:")
    print("  1. Open output/slides/nyc_safety_presentation.html in a browser")
    print("  2. Use arrow keys or space to navigate")
    print("  3. Press 'f' for fullscreen, 'o' for overview")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 