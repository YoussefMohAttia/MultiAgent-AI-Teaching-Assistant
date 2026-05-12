import os
import sys
import unittest
os.environ.setdefault("CLIENT_ID", "test-client")
os.environ.setdefault("CLIENT_SECRET", "test-secret")
os.environ.setdefault("TENANT_ID", "test-tenant")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-secret")

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

try:
    from fastapi.testclient import TestClient
    from main import app
    _IMPORT_ERROR = None
    _FASTAPI_READY = True
except Exception as exc:  # pragma: no cover - environment-specific
    TestClient = None
    app = None
    _IMPORT_ERROR = exc
    _FASTAPI_READY = False


@unittest.skipUnless(_FASTAPI_READY, f"fastapi not available: {_IMPORT_ERROR}")
class MainAppIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._startup_handlers = list(app.router.on_startup)
        cls._shutdown_handlers = list(app.router.on_shutdown)
        app.router.on_startup = []
        app.router.on_shutdown = []
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        app.router.on_startup = cls._startup_handlers
        app.router.on_shutdown = cls._shutdown_handlers

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"name": "Yousef"})

    def test_auth_status_without_session(self):
        response = self.client.get("/test-auth")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body.get("authenticated"), False)
        self.assertEqual(body.get("message"), "Not logged in")


if __name__ == "__main__":
    unittest.main()
