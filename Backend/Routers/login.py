from Core.google_client_config import GoogleClientConfig
from Core.config import settings
import auth
from auth import GoogleAuthorization
client_config = GoogleClientConfig()
google_auth = GoogleAuthorization(
    client_config=client_config,
    return_to_path=f"{settings.FRONTEND_URL.rstrip('/')}/dashboard"
)

router = google_auth.router
