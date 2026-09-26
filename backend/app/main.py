from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
import datetime
import os
from dotenv import load_dotenv

from app.routers import rescue, match, route, dashboard, andaza, production
from app.routers import processing_unit, reports, quality, iot, auth

load_dotenv()

app = FastAPI(title="Food Waste Reduction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(andaza.router, prefix="/andaza", tags=["Andaza"])
app.include_router(rescue.router, tags=["Rescue"])
app.include_router(match.router, tags=["Matching"])
app.include_router(route.router, tags=["Routing"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(production.router, tags=["Production"])
app.include_router(processing_unit.router, tags=["Processing Unit"])
app.include_router(reports.router, tags=["Reports"])
app.include_router(quality.router)
app.include_router(iot.router)

@app.on_event("startup")
def on_startup():
    from app.models.iot import IoTSensorData  # Ensure model is registered
    Base.metadata.create_all(bind=engine)
    from app.services.matching_context import seed_ngos
    from scripts.seed_processing_unit import seed_processing_unit
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        seed_ngos(db)
        seed_processing_unit(db)
    finally:
        db.close()

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()}
