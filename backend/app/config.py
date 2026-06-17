import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Application Settings
APP_NAME = "Agentic Growth OS"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# NVIDIA Stack Configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_API_BASE = os.getenv("NVIDIA_API_BASE", "https://integrate.api.nvidia.com/v1")

# NIM Model Choices
MODEL_OUTREACH = "meta/llama-3.3-70b-instruct"
MODEL_SCORING = "meta/llama-3.3-70b-instruct"
MODEL_AUDIT = "mistralai/mixtral-8x7b-instruct"
MODEL_EMBEDDING = "nvidia/nv-embedqa-e5-v5"

# Google Places Configuration
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")

# Database Configuration
# Defaults to a local SQLite database for zero-config running
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")
