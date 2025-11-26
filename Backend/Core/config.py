import os 

# Use environment variable or default to docker-compose settings
SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "postgresql://myuser:mypass@localhost:5432/mydb")