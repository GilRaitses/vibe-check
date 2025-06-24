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
    """Load all 907 cameras from zone-lookup.json instead of limited Firebase API"""
    try:
        # Load from local zone-lookup.json which has all 907 cameras
        with open('data/zone-lookup.json', 'r') as f:
            zone_data = json.load(f)
        
        cameras = []
        for camera_id, zone_info in zone_data.items():
            if zone_info.get('coordinates') and len(zone_info['coordinates']) == 2:
                cameras.append({
                    'lat': float(zone_info['coordinates'][1]),  # lat is second in array
                    'lng': float(zone_info['coordinates'][0]),  # lng is first in array  
                    'name': zone_info.get('camera_name', 'Unknown'),
                    'borough': zone_info.get('borough', 'Unknown'),
                    'zone_id': zone_info.get('zone_id', 'Unknown'),
                    'camera_id': camera_id
                })
        
        print(f"✅ Loaded {len(cameras)} cameras from zone-lookup.json")
        return cameras
        
    except Exception as e:
        print(f"Failed to load camera data from zone-lookup.json: {e}")
        
        # Fallback to Firebase API (limited to 100)
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
                print(f"⚠️ Fallback: Loaded {len(cameras)} cameras from Firebase API (limited)")
                return cameras
        except Exception as api_error:
            print(f"Firebase API also failed: {api_error}")
    
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
    
    # Create the figure with clean aesthetic design
    fig, ax = plt.subplots(1, 1, figsize=(16, 12))
    
    # Create beautiful peachy sunset gradient background
    gradient = np.linspace(0, 1, 256).reshape(1, -1)
    gradient = np.vstack((gradient, gradient))
    
    # Set up the gradient colors (peachy sunset)
    from matplotlib.colors import LinearSegmentedColormap
    colors = ['#FF6B6B', '#FF8E53', '#FF6B35', '#F7931E', '#FFB347', '#FFCF48']
    n_bins = 256
    cmap = LinearSegmentedColormap.from_list('sunset', colors, N=n_bins)
    
    # Apply gradient background
    ax.imshow(gradient, aspect='auto', cmap=cmap, extent=(-74.3, -73.7, 40.5, 40.92), alpha=0.8)
    
    # Plot NYC boundaries with subtle styling
    if geojson_data:
        for feature in geojson_data['features']:
            if feature['geometry']['type'] == 'Polygon':
                coords = feature['geometry']['coordinates'][0]
                polygon = MplPolygon(coords, fill=False, edgecolor='white', linewidth=1.5, alpha=0.7)
                ax.add_patch(polygon)
            elif feature['geometry']['type'] == 'MultiPolygon':
                for poly_coords in feature['geometry']['coordinates']:
                    coords = poly_coords[0]
                    polygon = MplPolygon(coords, fill=False, edgecolor='white', linewidth=1.5, alpha=0.7)
                    ax.add_patch(polygon)
    
    # Create subtle color palette for boroughs
    borough_colors = {
        'MN': '#FFFFFF',  # White
        'BK': '#FFF8DC',  # Cream  
        'QN': '#F0F8FF',  # Alice Blue
        'BX': '#F5F5DC',  # Beige
        'SI': '#FFFACD',  # Lemon Chiffon
        'Manhattan': '#FFFFFF',
        'Brooklyn': '#FFF8DC',
        'Queens': '#F0F8FF', 
        'Bronx': '#F5F5DC',
        'Staten Island': '#FFFACD'
    }
    
    # Plot CONSTRAINED Voronoi regions with subtle styling
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
        color = '#FFFFFF'  # Default white
        if i < len(cameras):
            borough = cameras[i].get('borough', 'Unknown')
            color = borough_colors.get(borough, color)
        
        # Create and add CLIPPED polygon with subtle styling
        polygon = MplPolygon(clipped_coords, 
                           facecolor=color, 
                           edgecolor='white', 
                           linewidth=0.3,
                           alpha=0.6)
        ax.add_patch(polygon)
    
    # Plot camera points as small elegant dots
    camera_lngs = [cam['lng'] for cam in cameras]
    camera_lats = [cam['lat'] for cam in cameras]
    ax.scatter(camera_lngs, camera_lats, c='#FF4444', s=3, alpha=0.9, zorder=5, edgecolors='white', linewidths=0.2)
    
    # Set NYC bounds
    ax.set_xlim(-74.3, -73.7)
    ax.set_ylim(40.5, 40.92)
    
    # Remove ALL plot elements for clean aesthetic
    ax.set_xticks([])
    ax.set_yticks([])
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.spines['left'].set_visible(False)
    
    # Remove any padding around the map
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    
    # Save the clean aesthetic map
    plt.savefig('nyc_vibe_check_camera_map.png', 
                dpi=300, 
                bbox_inches='tight',
                pad_inches=0,
                facecolor='none',
                edgecolor='none',
                transparent=False)
    
    print(f"✅ Created aesthetic tessellation: {clipped_cells}/{total_cells} cells")
    print("✅ Saved clean map asset: nyc_vibe_check_camera_map.png")
    plt.close()

if __name__ == "__main__":
    create_constrained_voronoi_tessellation() 