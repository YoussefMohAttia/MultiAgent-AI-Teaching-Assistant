# services/google_token_service.py
"""
Google OAuth token management
Handles refreshing access tokens
"""
import httpx
from typing import Optional, Dict


async def refresh_google_token(
    refresh_token: str,
    client_id: str,
    client_secret: str
) -> Optional[Dict]:
    """
    Refresh an expired Google access token
    
    Args:
        refresh_token: User's refresh token from database
        client_id: Your Google OAuth client ID
        client_secret:  Your Google OAuth client secret
    
    Returns:
        Dict with {"access_token": ".. .", "expires_in": 3599}
        Or None if refresh failed
    """
    url = "https://oauth2.googleapis.com/token"
    
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=data)
            
            if response.status_code == 200:
                token_data = response.json()
                # Google returns:  
                # {
                #   "access_token": "ya29.a0AfB_.. .",
                #   "expires_in": 3599,
                #   "token_type": "Bearer",
                #   "scope": "..."
                # }
                return {
                    "access_token":  token_data. get("access_token"),
                    "expires_in": token_data.get("expires_in", 3599)
                }
            else:
                print(f"❌ Token refresh failed: {response.status_code}")
                print(f"Response: {response. text}")
                return None
                
    except httpx.HTTPError as e:
        print(f"❌ HTTP error during token refresh: {e}")
        return None
    except Exception as e: 
        print(f"❌ Unexpected error during token refresh:  {e}")
        return None