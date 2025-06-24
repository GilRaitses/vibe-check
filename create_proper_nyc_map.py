#!/usr/bin/env python3
"""
Create NYC Voronoi tessellation CONSTRAINED to city boundaries
Uses nyc_boroughs_land_only.geojson to clip tessellation properly
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Polygon as MplPolygon
import numpy as np
import json
import requests
from scipy.spatial import Voronoi
from shapely.geometry import Point, Polygon, MultiPolygon
from shapely.ops import unary_union
import geopandas as gpd

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
    """Load NYC borough boundaries for constrained tessellation"""
    try:
        with open('data/nyc_boroughs_land_only.geojson', 'r') as f:
            geojson_data = json.load(f)
            
        # Create unified NYC landmass polygon for clipping
        polygons = []
        for feature in geojson_data['features']:
            geom = feature['geometry']
            if geom['type'] == 'Polygon':
                coords = geom['coordinates'][0]
                poly = Polygon(coords)
                if poly.is_valid:
                    polygons.append(poly)
            elif geom['type'] == 'MultiPolygon':
                for poly_coords in geom['coordinates']:
                    coords = poly_coords[0]
                    poly = Polygon(coords)
                    if poly.is_valid:
                        polygons.append(poly)
        
        # Combine all boroughs into single landmass
        if polygons:
            nyc_landmass = unary_union(polygons)
            print(f"✅ Created NYC landmass from {len(polygons)} borough polygons")
            return nyc_landmass, geojson_data
        
    except Exception as e:
        print(f"Error loading NYC boundaries: {e}")
    
    return None, None

def clip_voronoi_cell_to_nyc(cell_coords, nyc_landmass):
    """Clip a Voronoi cell to NYC boundaries"""
    try:
        # Create Shapely polygon from Voronoi cell
        if len(cell_coords) < 3:
            return []
            
        cell_polygon = Polygon(cell_coords)
        if not cell_polygon.is_valid:
            return []
        
        # Intersect with NYC landmass
        intersection = cell_polygon.intersection(nyc_landmass)
        
        if intersection.is_empty:
            return []
        
        # Handle different geometry types
        if isinstance(intersection, Polygon):
            if intersection.exterior:
                return list(intersection.exterior.coords)
        elif isinstance(intersection, MultiPolygon):
            # Use the largest polygon
            largest = max(intersection.geoms, key=lambda p: p.area)
            if largest.exterior:
                return list(largest.exterior.coords)
                
    except Exception as e:
        print(f"Warning: Failed to clip cell: {e}")
    
    return []

def create_constrained_voronoi_tessellation():
    """Create Voronoi tessellation constrained to NYC boundaries"""
    
    # Load real camera data
    cameras = load_camera_data()
    if not cameras:
        print("❌ No camera data available")
        return
    
    print(f"📊 Loaded {len(cameras)} cameras")
    
    # Load NYC boundaries for constraint
    nyc_landmass, geojson_data = load_nyc_boundaries()
    if not nyc_landmass:
        print("❌ Could not load NYC boundaries")
        return
    
    # Extract coordinates
    points = np.array([[cam['lng'], cam['lat']] for cam in cameras])
    
    # Create Voronoi diagram
    vor = Voronoi(points)
    
    # Create the figure with clean white background
    fig, ax = plt.subplots(1, 1, figsize=(16, 12))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')
    
    # Plot NYC boundaries first
    if geojson_data:
        for feature in geojson_data['features']:
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
    
    # Plot CONSTRAINED Voronoi regions
    clipped_cells = 0
    total_cells = 0
    
    for i, region in enumerate(vor.regions):
        if not region or -1 in region:
            continue
            
        total_cells += 1
        
        # Get polygon vertices
        polygon_vertices = [vor.vertices[j] for j in region]
        
        # CONSTRAINT: Clip to NYC boundaries
        clipped_coords = clip_voronoi_cell_to_nyc(polygon_vertices, nyc_landmass)
        
        if len(clipped_coords) < 3:
            continue  # Skip cells outside NYC
            
        clipped_cells += 1
        
        # Determine color based on camera borough
        color = '#E6E6FA'  # Default light lavender
        if i < len(cameras):
            borough = cameras[i].get('borough', 'Unknown')
            color = borough_colors.get(borough, color)
        
        # Create and add CLIPPED polygon
        polygon = MplPolygon(clipped_coords, 
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
    plt.title('NYC Vibe-Check: Constrained Voronoi Tessellation\n907 Camera Zones Clipped to City Boundaries', 
              fontsize=16, fontweight='bold', pad=20)
    
    # Add legend
    legend_elements = []
    for borough, color in borough_colors.items():
        if len(borough) == 2:  # Only show abbreviations
            legend_elements.append(patches.Patch(color=color, label=f'{borough}'))
    
    ax.legend(handles=legend_elements, loc='upper left', bbox_to_anchor=(0.02, 0.98))
    
    # Add constraint statistics
    constraint_text = f"Constrained: {clipped_cells}/{total_cells} cells clipped to NYC boundaries"
    ax.text(0.02, 0.02, constraint_text, transform=ax.transAxes, 
            bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8),
            fontsize=10)
    
    # Save the map
    plt.tight_layout()
    plt.savefig('nyc_vibe_check_camera_map.png', 
                dpi=300, 
                bbox_inches='tight',
                facecolor='white',
                edgecolor='none')
    
    print(f"✅ Created constrained Voronoi tessellation: {clipped_cells}/{total_cells} cells within NYC boundaries")
    print("✅ Saved to: nyc_vibe_check_camera_map.png")
    plt.close()

if __name__ == "__main__":
    create_constrained_voronoi_tessellation() 