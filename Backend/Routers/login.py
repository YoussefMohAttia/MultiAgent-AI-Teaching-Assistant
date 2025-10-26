from Core.msal_client_config import MSALClientConfig
from auth import MSALAuthorization
client_config = MSALClientConfig()
msal_auth = MSALAuthorization(client_config=client_config)

router = msal_auth.router
