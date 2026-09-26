from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base

class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    rescue_event_id = Column(Integer, ForeignKey("rescue_events.id"))
    ngo_id = Column(Integer, ForeignKey("ngos.id"))
    status = Column(String(20))
    route_waypoints = Column(JSON)
    total_distance_km = Column(Float)
    eta_minutes = Column(Integer)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    delivered_at = Column(DateTime(timezone=True), nullable=True)
