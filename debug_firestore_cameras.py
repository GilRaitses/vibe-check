#!/usr/bin/env python3

import json
import requests
from urllib.parse import urlparse

def debug_firestore_cameras():
    """Debug what camera URLs are actually stored in Firestore"""
    
    print("🔍 DEBUGGING FIRESTORE CAMERA URLS")
    print("="*50)
    
    # Get camera data from Firebase Functions API
    api_base = "https://us-central1-vibe-check-463816.cloudfunctions.net/api"
    
    try:
        # Get camera zones data
        print("\n📡 Fetching camera zones from Firebase...")
        response = requests.get(f"{api_base}/dashboard/camera-zones")
        
        if response.status_code != 200:
            print(f"❌ Failed to fetch camera zones: {response.status_code}")
            return
            
        data = response.json()
        cameras = data.get('dashboard_data', {}).get('camera_zones', [])
        
        print(f"✅ Found {len(cameras)} cameras in Firestore")
        
        # Analyze each camera's imageUrl
        placeholder_urls = []
        real_urls = []
        missing_urls = []
        
        print("\n📸 ANALYZING CAMERA URLS:")
        print("-" * 40)
        
        for i, camera in enumerate(cameras[:10]):  # Limit to first 10 for readability
            camera_id = camera.get('camera_id', 'unknown')
            camera_name = camera.get('camera_name', 'Unknown')
            
            print(f"\n{i+1}. {camera_id}")
            print(f"   Name: {camera_name}")
            
            # Check if camera object has imageUrl
            camera_obj = camera.get('camera', {})
            image_url = camera_obj.get('imageUrl', 'NO_URL_FOUND')
            
            if image_url == 'NO_URL_FOUND':
                missing_urls.append(camera_id)
                print(f"   URL: ❌ NO URL FOUND")
            elif 'multiview2.php' in image_url:
                placeholder_urls.append({
                    'camera_id': camera_id,
                    'name': camera_name,
                    'url': image_url
                })
                print(f"   URL: ❌ PLACEHOLDER - {image_url}")
            elif '/api/cameras/' in image_url and '/image' in image_url:
                # Extract UUID from real URL
                try:
                    uuid = image_url.split('/api/cameras/')[1].split('/image')[0]
                    real_urls.append({
                        'camera_id': camera_id,
                        'name': camera_name,
                        'url': image_url,
                        'uuid': uuid
                    })
                    print(f"   URL: ✅ REAL UUID - {uuid}")
                except:
                    print(f"   URL: ⚠️ MALFORMED - {image_url}")
            else:
                print(f"   URL: ❓ UNKNOWN FORMAT - {image_url}")
        
        # Summary
        print("\n" + "="*50)
        print("📊 SUMMARY:")
        print(f"   Total cameras analyzed: {min(len(cameras), 10)}")
        print(f"   ❌ Placeholder URLs: {len(placeholder_urls)}")
        print(f"   ✅ Real UUIDs: {len(real_urls)}")
        print(f"   🚫 Missing URLs: {len(missing_urls)}")
        
        # Show examples
        if placeholder_urls:
            print(f"\n❌ PLACEHOLDER URL EXAMPLES:")
            for p in placeholder_urls[:3]:
                print(f"   {p['camera_id']}: {p['url']}")
        
        if real_urls:
            print(f"\n✅ REAL UUID EXAMPLES:")
            for r in real_urls[:3]:
                print(f"   {r['camera_id']}: {r['uuid']}")
        
        # Test a real UUID if we have one
        if real_urls:
            print(f"\n🧪 TESTING REAL NYC API:")
            test_uuid = real_urls[0]['uuid']
            test_url = f"https://webcams.nyctmc.org/api/cameras/{test_uuid}/image"
            
            try:
                test_response = requests.head(test_url, timeout=10)
                print(f"   URL: {test_url}")
                print(f"   Status: {test_response.status_code}")
                print(f"   Content-Type: {test_response.headers.get('content-type', 'unknown')}")
                
                if test_response.status_code == 200:
                    print(f"   ✅ REAL CAMERA WORKS!")
                else:
                    print(f"   ❌ Camera offline or invalid")
                    
            except Exception as e:
                print(f"   ❌ Network error: {e}")
        
        # Show the actual Firebase monitoring endpoint test
        print(f"\n🔧 TESTING FIREBASE CAMERA IMAGE ENDPOINT:")
        if cameras:
            test_camera_id = cameras[0]['camera_id']
            firebase_url = f"{api_base}/dashboard/camera/{test_camera_id}/image"
            
            try:
                fb_response = requests.get(firebase_url, timeout=10)
                print(f"   URL: {firebase_url}")
                print(f"   Status: {fb_response.status_code}")
                
                if fb_response.status_code == 200:
                    content_type = fb_response.headers.get('content-type', '')
                    if 'image' in content_type:
                        print(f"   ✅ RETURNS IMAGE: {content_type}")
                    else:
                        print(f"   ❌ RETURNS: {content_type}")
                        print(f"   Response: {fb_response.text[:200]}...")
                else:
                    print(f"   ❌ Error: {fb_response.text[:200]}...")
                    
            except Exception as e:
                print(f"   ❌ Network error: {e}")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        if placeholder_urls:
            print(f"   1. Replace {len(placeholder_urls)} placeholder URLs with real NYC camera UUIDs")
            print(f"   2. Use NYC Traffic Management API to get valid camera UUIDs")
        if real_urls:
            print(f"   3. {len(real_urls)} cameras already have correct format - use as examples")
        print(f"   4. Update Firestore monitoring_schedules collection")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    debug_firestore_cameras() 