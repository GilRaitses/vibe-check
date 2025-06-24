#!/usr/bin/env python3
"""
Create proper NYC Voronoi tessellation map with clean polygon boundaries
Matches the clean academic-style visualization shown in reference
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Polygon as MplPolygon
import numpy as np
import json
import requests
from scipy.spatial import Voronoi, voronoi_plot_2d
from shapely.geometry import Point, Polygon, MultiPolygon
import geopandas as gpd
from matplotlib.collections import PatchCollection

def load_camera_data():
    """Load real camera data from Firebase API"""
    try:
        response = requests.get('https://us-central1-vibe-check-463816.cloudfunctions.net/api/dashboard/camera-zones')
        data = response.json()
        
        if 'zones' in data:
            cameras = []
            for zone in data['zones']:
                if zone.get('latitude') and zone.get('longitude'):
                    cameras.append({
                        'lat': float(zone['latitude']),
                        'lng': float(zone['longitude']),
                        'name': zone.get('name', 'Unknown'),
                        'borough': zone.get('neighborhood', 'Unknown'),
                        'zone_id': zone.get('zone_id', 'Unknown')
                    })
            return cameras
    except Exception as e:
        print(f"Failed to load camera data: {e}")
    
    return []

def load_nyc_boundaries():
    """Load NYC borough boundaries"""
    try:
        with open('data/nyc_boroughs_land_only.geojson', 'r') as f:
            return json.load(f)
    except:
        print("Warning: Could not load borough boundaries")
        return None

def create_voronoi_tessellation():
    """Create the proper Voronoi tessellation visualization"""
    
    # Load real camera data
    cameras = load_camera_data()
    if not cameras:
        print("❌ No camera data available")
        return
    
    print(f"📊 Loaded {len(cameras)} cameras")
    
    # Extract coordinates
    points = np.array([[cam['lng'], cam['lat']] for cam in cameras])
    
    # Create Voronoi diagram
    vor = Voronoi(points)
    
    # Create the figure with clean white background
    fig, ax = plt.subplots(1, 1, figsize=(16, 12))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')
    
    # Load and plot NYC boundaries
    nyc_bounds = load_nyc_boundaries()
    if nyc_bounds:
        for feature in nyc_bounds['features']:
            if feature['geometry']['type'] == 'Polygon':
                coords = feature['geometry']['coordinates'][0]
                polygon = MplPolygon(coords, fill=False, edgecolor='black', linewidth=2)
                ax.add_patch(polygon)
            elif feature['geometry']['type'] == 'MultiPolygon':
                for poly_coords in feature['geometry']['coordinates']:
                    coords = poly_coords[0]
                    polygon = MplPolygon(coords, fill=False, edgecolor='black', linewidth=2)
                    ax.add_patch(polygon)
    
    # Create color palette for boroughs
    borough_colors = {
        'MN': '#FFB6C1',  # Light pink
        'BK': '#98FB98',  # Pale green  
        'QN': '#87CEEB',  # Sky blue
        'BX': '#DDA0DD',  # Plum
        'SI': '#F0E68C',  # Khaki
        'Manhattan': '#FFB6C1',
        'Brooklyn': '#98FB98',
        'Queens': '#87CEEB', 
        'Bronx': '#DDA0DD',
        'Staten Island': '#F0E68C'
    }
    
    # Plot Voronoi regions with clean polygons
    for i, region in enumerate(vor.regions):
        if not region or -1 in region:
            continue
            
        # Get polygon vertices
        polygon_vertices = [vor.vertices[j] for j in region]
        
        # Determine color based on nearest camera borough
        color = '#E6E6FA'  # Default light lavender
        if i < len(cameras):
            borough = cameras[i].get('borough', 'Unknown')
            color = borough_colors.get(borough, color)
        
        # Create and add polygon
        polygon = MplPolygon(polygon_vertices, 
                           facecolor=color, 
                           edgecolor='blue', 
                           linewidth=0.5,
                           alpha=0.7)
        ax.add_patch(polygon)
    
    # Plot camera points as red dots
    camera_lngs = [cam['lng'] for cam in cameras]
    camera_lats = [cam['lat'] for cam in cameras]
    ax.scatter(camera_lngs, camera_lats, c='red', s=8, alpha=0.8, zorder=5)
    
    # Set NYC bounds
    ax.set_xlim(-74.3, -73.7)
    ax.set_ylim(40.5, 40.92)
    
    # Clean styling
    ax.set_xlabel('Longitude', fontsize=12)
    ax.set_ylabel('Latitude', fontsize=12)
    ax.grid(True, alpha=0.3)
    
    # Add title
    plt.title('NYC Vibe-Check: Complete Voronoi Tessellation\n907 Camera Zones Across All 5 Boroughs', 
              fontsize=16, fontweight='bold', pad=20)
    
    # Add legend
    legend_elements = []
    for borough, color in borough_colors.items():
        if len(borough) == 2:  # Only show abbreviations
            legend_elements.append(patches.Patch(color=color, label=f'{borough}'))
    
    ax.legend(handles=legend_elements, loc='upper left', bbox_to_anchor=(0.02, 0.98))
    
    # Save the map
    plt.tight_layout()
    plt.savefig('nyc_vibe_check_camera_map.png', 
                dpi=300, 
                bbox_inches='tight',
                facecolor='white',
                edgecolor='none')
    
    print("✅ Created proper Voronoi tessellation map: nyc_vibe_check_camera_map.png")
    plt.close()

if __name__ == "__main__":
    create_voronoi_tessellation() 