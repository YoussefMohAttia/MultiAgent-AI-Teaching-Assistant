
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from DB.session import get_db
from DB import crud
from services.google_classroom_service import GoogleClassroomService
from Core. config import settings

router = APIRouter(prefix="/api/google-classroom", tags=["Google Classroom"])

# Initialize service
google_service = GoogleClassroomService()


@router.post("/sync-courses")
async def sync_courses(
    user_id:  int,  # TODO: Get from JWT token later
    db: AsyncSession = Depends(get_db)
):
    """
    Sync user's Google Classroom courses to database
    
    Steps:
    1. Get valid access token (auto-refresh if needed)
    2. Fetch courses from Google Classroom API
    3. Save/update courses in our database
    """
    # 1. Get valid access token
    access_token = await crud.get_valid_access_token(
        db=db,
        user_id=user_id,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET
    )
    
    if not access_token: 
        raise HTTPException(
            status_code=401,
            detail="Could not get valid access token.  Please login again."
        )
    
    # 2. Fetch courses from Google
    courses_data = await google_service.fetch_courses(access_token)
    
    if not courses_data:
        return {
            "success": True,
            "message": "No courses found or unable to fetch courses",
            "synced":  0,
            "total":  0
        }
    
    # 3. Save/update courses in database
    synced_count = 0
    updated_count = 0
    
    for course_data in courses_data:
        classroom_id = course_data. get("id")
        title = course_data.get("name", "Untitled Course")
        
        # Check if course already exists
        existing_course = await crud.get_course_by_classroom_id(db, classroom_id)
        
        if existing_course:
            # Update existing course
            await crud.update_course(db, existing_course, title)
            updated_count += 1
        else:
            # Create new course
            await crud.create_course(
                db=db,
                user_id=user_id,
                classroom_id=classroom_id,
                title=title
            )
            synced_count += 1
    
    return {
        "success": True,
        "message": "Courses synced successfully",
        "new_courses": synced_count,
        "updated_courses": updated_count,
        "total_courses": len(courses_data)
    }


@router.get("/courses")
async def get_synced_courses(
    user_id: int,  # TODO:  Get from JWT token later
    db: AsyncSession = Depends(get_db)
):
    """
    Get all courses synced from Google Classroom for this user
    """
    courses = await crud.get_user_courses(db, user_id)
    
    return {
        "success": True,
        "count": len(courses),
        "courses": [
            {
                "id":  course.id,
                "classroom_id": course.classroom_id,
                "title": course. title,
                "created_at": course.created_at.isoformat() if course.created_at else None
            }
            for course in courses
        ]
    }


@router.post("/sync-materials/{course_id}")
async def sync_course_materials(
    course_id: int,
    user_id: int,  # TODO: Get from JWT
    db: AsyncSession = Depends(get_db)
):
    """
    Sync materials for a specific course
    """
    # 1. Get course
    course = await crud.get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 2. Get valid access token
    access_token = await crud. get_valid_access_token(
        db=db,
        user_id=user_id,
        client_id=settings. GOOGLE_CLIENT_ID,
        client_secret=settings. GOOGLE_CLIENT_SECRET
    )
    
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Could not get valid access token"
        )
    
    # 3. Fetch materials from Google
    materials = await google_service.fetch_course_materials(
        access_token, 
        course. classroom_id
    )
    
    if not materials:
        return {
            "success": True,
            "message": "No materials found",
            "synced":  0
        }
    
    # 4. Save materials to database
    synced_count = 0
    for material in materials:
        material_id = material.get("id")
        title = material.get("title", "Untitled")
        
        # Extract Google Drive URL if exists
        drive_url = None
        if "materials" in material:
            for mat in material["materials"]:
                if "driveFile" in mat:
                    drive_url = mat["driveFile"].get("alternateLink")
                    break
        
        await crud.create_document(
            db=db,
            course_id=course_id,
            classroom_material_id=material_id,
            title=title,
            google_drive_url=drive_url
        )
        synced_count += 1
    
    return {
        "success": True,
        "message": "Materials synced successfully",
        "synced": synced_count
    }