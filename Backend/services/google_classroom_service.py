"""
Google Classroom API service
Handles all fetching from the Google Classroom REST API.

Endpoints used:
  GET /courses                                → list courses
  GET /courses/{id}/courseWorkMaterials       → pure study materials
  GET /courses/{id}/announcements             → teacher announcements
  GET /courses/{id}/courseWork                → assignments (filtered to Drive-attached only)
"""
import httpx
from typing import List, Dict, Optional


class GoogleClassroomService:
    """Service for all Google Classroom API calls"""

    BASE_URL = "https://classroom.googleapis.com/v1"

    # -------------------------
    # Internal helper
    # -------------------------
    async def _get(self, url: str, access_token: str, params: dict = None) -> Optional[dict]:
        """
        Shared async GET helper.
        Returns parsed JSON dict on success, None on any error.
        Handles 401 / 403 / timeout explicitly so callers get clean None.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {access_token}"},
                    params=params or {}
                )
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 401:
                    print(f"❌ 401 Unauthorized on {url} — token may be expired")
                elif response.status_code == 403:
                    print(f"❌ 403 Forbidden on {url} — missing scope or permission")
                else:
                    print(f"❌ {response.status_code} on {url}: {response.text}")
                return None
        except httpx.TimeoutException:
            print(f"❌ Timeout on {url}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error on {url}: {e}")
            return None

    # -------------------------
    # Courses
    # -------------------------
    async def fetch_courses(self, access_token: str) -> List[Dict]:
        """
        Fetch all courses for the authenticated user.
        Returns list of course dicts from Google.
        Each dict contains at minimum: id, name
        """
        data = await self._get(f"{self.BASE_URL}/courses", access_token)
        if not data:
            return []
        courses = data.get("courses", [])
        print(f"✅ Fetched {len(courses)} courses")
        return courses

    # -------------------------
    # Course Materials
    # -------------------------
    async def fetch_course_materials(self, classroom_id: str, access_token: str) -> List[Dict]:
        """
        Fetch pure study materials posted in a course (courseWorkMaterials).
        These are materials the teacher explicitly posted as study resources —
        NOT assignments, NOT announcements.

        Each item may contain:
          - id                        → classroom_material_id
          - title                     → document title
          - description               → optional text body
          - materials[]               → list of attached resources
              - driveFile.driveFile.alternateLink  → Google Drive file URL
              - link.url              → external URL
              - youtubeVideo.alternateLink         → YouTube URL

        doc_type will be set to "material"
        """
        url = f"{self.BASE_URL}/courses/{classroom_id}/courseWorkMaterials"
        data = await self._get(url, access_token)
        if not data:
            return []
        items = data.get("courseWorkMaterial", [])
        print(f"  ✅ Fetched {len(items)} materials for course {classroom_id}")
        return items

    # -------------------------
    # Announcements
    # -------------------------
    async def fetch_announcements(self, classroom_id: str, access_token: str) -> List[Dict]:
        """
        Fetch all announcements posted in a course.
        Announcements are plain-text posts by the teacher — no Drive attachment required.

        Each item contains:
          - id          → classroom_material_id
          - text        → the announcement body (stored as raw_text)
          - materials[] → optional attachments (same structure as courseWorkMaterials)

        doc_type will be set to "announcement"
        """
        url = f"{self.BASE_URL}/courses/{classroom_id}/announcements"
        data = await self._get(url, access_token)
        if not data:
            return []
        items = data.get("announcements", [])
        print(f"  ✅ Fetched {len(items)} announcements for course {classroom_id}")
        return items

    # -------------------------
    # Assignments (courseWork)
    # -------------------------
    async def fetch_coursework(self, classroom_id: str, access_token: str) -> List[Dict]:
        """
        Fetch assignments from a course, filtered to only those WITH Drive file attachments.
        Pure Google Form / MCQ assignments with no Drive file are skipped — they are
        not useful for the AI pipeline (no text content to extract).

        Each returned item contains:
          - id                        → classroom_material_id
          - title                     → assignment title
          - description               → assignment instructions (stored as raw_text)
          - materials[]               → attached Drive files / links

        doc_type will be set to "coursework"
        """
        url = f"{self.BASE_URL}/courses/{classroom_id}/courseWork"
        data = await self._get(url, access_token)
        if not data:
            return []

        all_items = data.get("courseWork", [])

        # Filter: only keep items that have at least one driveFile attachment
        filtered = []
        for item in all_items:
            materials = item.get("materials", [])
            has_drive_file = any("driveFile" in m for m in materials)
            if has_drive_file:
                filtered.append(item)

        skipped = len(all_items) - len(filtered)
        print(f"  ✅ Fetched {len(filtered)} coursework items for course {classroom_id} "
              f"(skipped {skipped} with no Drive attachments)")
        return filtered

    # -------------------------
    # URL extractor helper
    # -------------------------
    def extract_drive_url(self, materials: list) -> Optional[str]:
        """
        Given a materials[] list from any Google Classroom item,
        extract the first Google Drive file URL found.
        Falls back to first external link if no Drive file.
        Returns None if no URL found.

        Priority:
          1. driveFile.driveFile.alternateLink  (Drive file)
          2. link.url                            (external URL)
          3. youtubeVideo.alternateLink          (YouTube)
        """
        for m in materials:
            if "driveFile" in m:
                return m["driveFile"].get("driveFile", {}).get("alternateLink")
        for m in materials:
            if "link" in m:
                return m["link"].get("url")
        for m in materials:
            if "youtubeVideo" in m:
                return m["youtubeVideo"].get("alternateLink")
        return None