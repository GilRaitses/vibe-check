#!/usr/bin/env python3

import json
import numpy as np
from scipy.spatial import Voronoi, voronoi_plot_2d
import matplotlib.pyplot as plt
from shapely.geometry import Point, Polygon, MultiPolygon
from shapely.ops import unary_union
import geopandas as gpd
from shapely.validation import make_valid
import warnings
warnings.filterwarnings("ignore")

print("🎯 REAL VORONOI TESSELLATION - Python Implementation")
print("🔧 Using scipy.spatial.Voronoi + proper geometric constraints")

# Load data
try:
    with open('data/cameras-with-handles.json', 'r') as f:
        cameras = json.load(f)
    print(f"📸 Loaded {len(cameras)} cameras")
    
    with open('data/nyc_boroughs_with_water.geojson', 'r') as f:
        nyc_boroughs = json.load(f)
    print(f"🗽 Loaded {len(nyc_boroughs['features'])} NYC boroughs")
    
except FileNotFoundError as e:
    print(f"❌ Error loading data: {e}")
    exit(1)

# Extract camera coordinates
camera_points = []
camera_info = []

for camera in cameras:
    if camera.get('coordinates') and len(camera['coordinates']) == 2:
        lat, lng = camera['coordinates']
        # Validate coordinates are in reasonable NYC range
        if 40.4 <= lat <= 41.0 and -74.5 <= lng <= -73.5:
            camera_points.append([lng, lat])  # [longitude, latitude]
            camera_info.append({
                'handle': camera.get('handle', 'unknown'),
                'name': camera.get('name', 'unknown'),
                'integer_id': camera.get('integer_id', 0)
            })

camera_points = np.array(camera_points)
print(f"📍 Valid NYC camera points: {len(camera_points)}")

if len(camera_points) < 4:
    print("❌ Need at least 4 points for Voronoi tessellation")
    exit(1)

# Create NYC boundary polygon from GeoJSON
print("🗺️ Creating NYC boundary polygon...")
nyc_polygons = []

for feature in nyc_boroughs['features']:
    geom = feature['geometry']
    if geom['type'] == 'Polygon':
        coords = geom['coordinates'][0]
        poly = Polygon(coords)
        if poly.is_valid:
            nyc_polygons.append(poly)
    elif geom['type'] == 'MultiPolygon':
        for polygon_coords in geom['coordinates']:
            coords = polygon_coords[0]
            poly = Polygon(coords)
            if poly.is_valid:
                nyc_polygons.append(poly)

# Union all borough polygons to create NYC boundary
if nyc_polygons:
    nyc_boundary = unary_union(nyc_polygons)
    if not nyc_boundary.is_valid:
        nyc_boundary = make_valid(nyc_boundary)
    print(f"✅ Created NYC boundary polygon")
    print(f"📊 NYC area: {nyc_boundary.area:.6f} square degrees")
else:
    print("❌ Failed to create NYC boundary")
    exit(1)

# Create bounding box for Voronoi
bounds = nyc_boundary.bounds  # (minx, miny, maxx, maxy)
print(f"📦 NYC bounds: {bounds}")

# Add boundary points to ensure finite Voronoi regions
margin = 0.1  # Add margin around boundary
boundary_points = [
    [bounds[0] - margin, bounds[1] - margin],  # bottom-left
    [bounds[2] + margin, bounds[1] - margin],  # bottom-right
    [bounds[2] + margin, bounds[3] + margin],  # top-right
    [bounds[0] - margin, bounds[3] + margin],  # top-left
]

# Combine camera points with boundary points
all_points = np.vstack([camera_points, boundary_points])
print(f"🔢 Total points for Voronoi: {len(all_points)} ({len(camera_points)} cameras + {len(boundary_points)} boundary)")

# Generate Voronoi diagram
print("⚡ Generating Voronoi tessellation...")
vor = Voronoi(all_points)
print(f"✅ Voronoi generated: {len(vor.regions)} regions")

# Process Voronoi regions and constrain to NYC boundary
tessellation_zones = []
valid_zones = 0
constrained_zones = 0

for point_idx in range(len(camera_points)):  # Only process camera points, not boundary points
    camera = camera_info[point_idx]
    camera_point = camera_points[point_idx]
    
    # Find the Voronoi region for this point
    region_idx = vor.point_region[point_idx]
    region = vor.regions[region_idx]
    
    if not region or -1 in region:  # Skip infinite regions
        print(f"⚠️ Skipping infinite region for camera {camera['handle']}")
        continue
    
    # Get vertices of the Voronoi cell
    vertices = vor.vertices[region]
    if len(vertices) < 3:
        print(f"⚠️ Skipping degenerate region for camera {camera['handle']}")
        continue
    
    try:
        # Create polygon from Voronoi vertices
        voronoi_poly = Polygon(vertices)
        if not voronoi_poly.is_valid:
            voronoi_poly = make_valid(voronoi_poly)
        
        # Constrain to NYC boundary
        constrained_poly = voronoi_poly.intersection(nyc_boundary)
        
        if constrained_poly.is_empty:
            print(f"⚠️ No intersection with NYC for camera {camera['handle']}")
            continue
        
        # Handle MultiPolygon results (take largest piece)
        if isinstance(constrained_poly, MultiPolygon):
            largest_area = 0
            largest_poly = None
            for poly in constrained_poly.geoms:
                if poly.area > largest_area:
                    largest_area = poly.area
                    largest_poly = poly
            constrained_poly = largest_poly
        
        if constrained_poly and constrained_poly.area > 0:
            # Convert back to coordinates list
            coords = list(constrained_poly.exterior.coords)
            
            # Check if this was actually constrained by boundary
            was_constrained = not voronoi_poly.equals(constrained_poly)
            if was_constrained:
                constrained_zones += 1
            
            zone = {
                'integer_id': camera['integer_id'],
                'handle': camera['handle'], 
                'name': camera['name'],
                'coordinates': [camera_point[1], camera_point[0]],  # [lat, lng]
                'voronoi_polygon': {
                    'type': 'Polygon',
                    'coordinates': [coords]
                },
                'zone_area_sqm': constrained_poly.area * 111000 * 111000,  # Rough conversion to m²
                'vertices_count': len(coords) - 1,  # -1 because polygon is closed
                'is_land_zone': True,
                'is_bridge_zone': False,
                'bounded_by_coastline': was_constrained,
                'coverage_quality': 'real_voronoi_constrained' if was_constrained else 'real_voronoi',
                'tessellation_method': 'scipy_voronoi_with_geometric_constraints'
            }
            
            tessellation_zones.append(zone)
            valid_zones += 1
            
            if valid_zones % 100 == 0:
                print(f"✅ Processed {valid_zones} zones...")
                
    except Exception as e:
        print(f"❌ Error processing camera {camera['handle']}: {e}")
        continue

print(f"\n🎯 REAL VORONOI TESSELLATION COMPLETE:")
print(f"✅ Valid zones created: {valid_zones}")
print(f"🏖️ Boundary-constrained zones: {constrained_zones}")
print(f"📊 Constraint rate: {(constrained_zones/valid_zones*100):.1f}%")

if valid_zones > 0:
    # Calculate statistics
    total_area = sum(zone['zone_area_sqm'] for zone in tessellation_zones)
    avg_area = total_area / valid_zones
    avg_vertices = sum(zone['vertices_count'] for zone in tessellation_zones) / valid_zones
    
    print(f"📊 Total coverage area: {total_area/1000000:.2f} km²")
    print(f"📊 Average zone size: {avg_area/1000000:.3f} km²")
    print(f"📊 Average vertices per zone: {avg_vertices:.1f}")
    
    # Save results
    results = {
        'generated_at': '2025-06-24T12:33:00Z',
        'algorithm': 'scipy_voronoi_with_geometric_constraints',
        'total_zones': valid_zones,
        'constrained_zones': constrained_zones,
        'constraint_success_rate': constrained_zones/valid_zones*100,
        'total_area_km2': total_area/1000000,
        'average_zone_size_km2': avg_area/1000000,
        'average_vertices': avg_vertices,
        'method': 'real_voronoi_tessellation_python'
    }
    
    # Save zones
    with open('data/python_voronoi_zones.json', 'w') as f:
        json.dump(tessellation_zones, f, indent=2)
    
    # Save summary
    with open('data/python_voronoi_summary.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Saved {valid_zones} zones to python_voronoi_zones.json")
    print(f"💾 Saved summary to python_voronoi_summary.json")
    
    # Create a simple visualization
    print("\n📊 Creating visualization...")
    try:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Plot 1: Original Voronoi
        voronoi_plot_2d(vor, ax=ax1, show_vertices=False, line_colors='blue', line_width=0.5)
        ax1.plot(camera_points[:, 0], camera_points[:, 1], 'ro', markersize=2)
        ax1.set_xlim(bounds[0], bounds[2])
        ax1.set_ylim(bounds[1], bounds[3])
        ax1.set_title('Original Voronoi Diagram')
        ax1.set_aspect('equal')
        
        # Plot 2: Constrained zones
        for zone in tessellation_zones[:50]:  # Plot first 50 for visibility
            coords = zone['voronoi_polygon']['coordinates'][0]
            xs, ys = zip(*coords)
            color = 'red' if zone['bounded_by_coastline'] else 'blue'
            ax2.plot(xs, ys, color=color, linewidth=0.5)
            ax2.fill(xs, ys, color=color, alpha=0.1)
        
        ax2.plot(camera_points[:50, 0], camera_points[:50, 1], 'ko', markersize=1)
        ax2.set_xlim(bounds[0], bounds[2])
        ax2.set_ylim(bounds[1], bounds[3])
        ax2.set_title('Constrained Zones (Red=Boundary Constrained)')
        ax2.set_aspect('equal')
        
        plt.tight_layout()
        plt.savefig('voronoi_tessellation_debug.png', dpi=150, bbox_inches='tight')
        print("💾 Saved visualization to voronoi_tessellation_debug.png")
        
    except Exception as e:
        print(f"⚠️ Visualization failed: {e}")
    
    print("\n🎯 PYTHON IMPLEMENTATION COMPLETE!")
    print("🔧 Now ready to port to JavaScript with confidence")
    
else:
    print("❌ No valid zones created - check input data") 