from Core.google_client_config import GoogleClientConfig
import auth
from auth import GoogleAuthorization
client_config = GoogleClientConfig()
google_auth = GoogleAuthorization(client_config=client_config)

router = google_auth.router
