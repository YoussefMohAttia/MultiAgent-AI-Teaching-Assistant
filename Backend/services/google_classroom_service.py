# services/google_classroom_service.py
"""
Google Classroom API service
Handles fetching data from Google Classroom
"""
import httpx
from typing import List, Dict, Optional


class GoogleClassroomService: 
    """Service for Google Classroom API calls"""
    
    BASE_URL = "https://classroom.googleapis.com/v1"
    
    async def fetch_courses(self, access_token: str) -> List[Dict]:
        """
        Fetch all courses for the authenticated user
        
        Args: 
            access_token: Valid Google access token
        
        Returns:
            List of course dictionaries from Google Classroom
        """
        url = f"{self.BASE_URL}/courses"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    courses = data.get("courses", [])
                    print(f"✅ Fetched {len(courses)} courses from Google Classroom")
                    return courses
                    
                elif response.status_code == 401:
                    print("❌ Unauthorized - token may be invalid")
                    return []
                    
                elif response.status_code == 403:
                    print("❌ Forbidden - no permission to access courses")
                    return []
                    
                else:
                    print(f"❌ Failed to fetch courses: {response.status_code}")
                    print(f"Response: {response. text}")
                    return []
                    
        except httpx.TimeoutException:
            print("❌ Request timed out")
            return []
        except Exception as e:
            print(f"❌ Error fetching courses: {e}")
            return []
    
    async def fetch_courses(self, access_token: str) -> List[Dict]:
        """
        Fetch all courses for the authenticated user
        
        Args:  
            access_token: Valid Google access token
        
        Returns:
            List of course dictionaries from Google Classroom
        """
        url = f"{self.BASE_URL}/courses"
        
        print(f"🔑 Using access token: {access_token[: 50]}...")  # Show first 50 chars
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                print(f"📡 API URL: {url}")
                print(f"📡 Status Code: {response.status_code}")
                print(f"📡 Response Headers: {dict(response.headers)}")
                print(f"📡 Response Body: {response.text}")
                
                if response.status_code == 200:
                    data = response.json()
                    courses = data.get("courses", [])
                    print(f"✅ Fetched {len(courses)} courses from Google Classroom")
                    if courses:
                        print(f"📚 Courses:  {[c.get('name') for c in courses]}")
                    return courses
                    
                elif response.status_code == 401:
                    print("❌ Unauthorized - token may be invalid")
                    print(f"❌ Response: {response.text}")
                    return []
                    
                elif response.status_code == 403:
                    print("❌ Forbidden - no permission to access courses")
                    try:
                        error_data = response.json()
                        print(f"❌ Error details: {error_data}")
                    except:
                        print(f"❌ Raw response: {response.text}")
                    return []
                    
                else:  
                    print(f"❌ Failed to fetch courses: {response.status_code}")
                    print(f"Response: {response.text}")
                    return []
                    
        except httpx.TimeoutException:
            print("❌ Request timed out")
            return []
        except Exception as e:
            print(f"❌ Error fetching courses:  {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def fetch_announcements(
        self, 
        access_token: str, 
        course_id: str
    ) -> List[Dict]:
        """
        Fetch announcements for a specific course
        
        Args:
            access_token:  Valid Google access token
            course_id: Google Classroom course ID
        
        Returns:
            List of announcement dictionaries
        """
        url = f"{self.BASE_URL}/courses/{course_id}/announcements"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    announcements = data.get("announcements", [])
                    print(f"✅ Fetched {len(announcements)} announcements for course {course_id}")
                    return announcements
                else:
                    print(f"❌ Failed to fetch announcements: {response.status_code}")
                    return []
                    
        except Exception as e: 
            print(f"❌ Error fetching announcements: {e}")
            return []