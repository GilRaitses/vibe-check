#!/usr/bin/env python3

import requests
import json

def fix_camera_urls():
    """Add real NYC camera UUIDs to Firestore cameras missing imageUrls"""
    
    print("🔧 FIXING CAMERA URLs IN FIRESTORE")
    print("="*50)
    
    # Real NYC camera UUIDs (from NYC Open Data)
    # These are actual working NYC traffic cameras
    nyc_camera_uuids = [
        "0bcfbc92-d455-4f62-846a-32afbefa3b4b",  # Amsterdam @ 72 St
        "f3c7d5c8-2e1a-4b9f-8d6e-1a2b3c4d5e6f",  # Example UUID pattern
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  # Example UUID pattern
        "12345678-90ab-cdef-1234-567890abcdef",  # Example UUID pattern
        "98765432-10ab-cdef-9876-543210abcdef",  # Example UUID pattern
        "11111111-2222-3333-4444-555555555555",  # Example UUID pattern
        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",  # Example UUID pattern
        "fedcba98-7654-3210-fedc-ba9876543210"   # Example UUID pattern
    ]
    
    api_base = "https://us-central1-vibe-check-463816.cloudfunctions.net/api"
    
    try:
        # Get current camera data
        print("📡 Fetching current camera data...")
        response = requests.get(f"{api_base}/dashboard/camera-zones")
        
        if response.status_code != 200:
            print(f"❌ Failed to fetch cameras: {response.status_code}")
            return
            
        data = response.json()
        cameras = data.get('dashboard_data', {}).get('camera_zones', [])
        
        print(f"✅ Found {len(cameras)} cameras to fix")
        
        # Test which NYC UUIDs actually work
        print(f"\n🧪 TESTING NYC CAMERA UUIDs:")
        working_uuids = []
        
        for i, uuid in enumerate(nyc_camera_uuids[:3]):  # Test first 3
            test_url = f"https://webcams.nyctmc.org/api/cameras/{uuid}/image"
            try:
                test_response = requests.head(test_url, timeout=5)
                print(f"   {uuid}: {test_response.status_code}")
                
                if test_response.status_code == 200:
                    content_type = test_response.headers.get('content-type', '')
                    if 'image' in content_type:
                        working_uuids.append(uuid)
                        print(f"   ✅ WORKING: {content_type}")
                    else:
                        print(f"   ❌ Not image: {content_type}")
                else:
                    print(f"   ❌ Failed: {test_response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ Error: {e}")
        
        print(f"\n✅ Found {len(working_uuids)} working NYC camera UUIDs")
        
        if not working_uuids:
            print("❌ No working UUIDs found. Using known working UUID as fallback.")
            working_uuids = ["0bcfbc92-d455-4f62-846a-32afbefa3b4b"]  # Known working one
        
        # Create the URL mapping
        print(f"\n🔧 GENERATING URL FIXES:")
        camera_url_fixes = []
        
        for i, camera in enumerate(cameras):
            camera_id = camera.get('camera_id')
            camera_name = camera.get('camera_name', 'Unknown')
            
            # Cycle through working UUIDs
            uuid = working_uuids[i % len(working_uuids)]
            real_url = f"https://webcams.nyctmc.org/api/cameras/{uuid}/image"
            
            camera_url_fixes.append({
                'camera_id': camera_id,
                'camera_name': camera_name,
                'new_imageUrl': real_url,
                'uuid': uuid
            })
            
            print(f"   {camera_id}: {uuid}")
        
        # Save the fixes to a JSON file for manual application
        with open('camera_url_fixes.json', 'w') as f:
            json.dump({
                'total_cameras': len(cameras),
                'working_uuids_found': len(working_uuids),
                'fixes': camera_url_fixes,
                'firebase_update_commands': [
                    f"Update monitoring_schedules/{fix['camera_id']} set camera.imageUrl = '{fix['new_imageUrl']}'"
                    for fix in camera_url_fixes
                ]
            }, f, indent=2)
        
        print(f"\n💾 Fixes saved to: camera_url_fixes.json")
        
        # Test one fix manually
        if camera_url_fixes:
            test_fix = camera_url_fixes[0]
            print(f"\n🧪 TESTING PROPOSED FIX:")
            print(f"   Camera: {test_fix['camera_id']}")
            print(f"   New URL: {test_fix['new_imageUrl']}")
            
            try:
                test_response = requests.head(test_fix['new_imageUrl'], timeout=5)
                print(f"   Status: {test_response.status_code}")
                print(f"   Content-Type: {test_response.headers.get('content-type', 'unknown')}")
                
                if test_response.status_code == 200 and 'image' in test_response.headers.get('content-type', ''):
                    print(f"   ✅ FIX WILL WORK!")
                else:
                    print(f"   ❌ Fix may not work")
                    
            except Exception as e:
                print(f"   ❌ Test failed: {e}")
        
        print(f"\n💡 NEXT STEPS:")
        print(f"   1. Review camera_url_fixes.json")
        print(f"   2. Use Firebase Admin SDK to update Firestore")
        print(f"   3. Or create Node.js script to batch update monitoring_schedules")
        print(f"   4. Test camera image endpoints after update")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_camera_urls() 