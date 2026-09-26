from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.route import RouteResponse, Waypoint, RouteRequest
from app.models.kitchen import Kitchen
from app.models.delivery import Delivery
from app.models.ngo import NGO
from app.models.rescue import RescueEvent
from app.models.food_category import FoodCategory
from app.services.osrm_client import get_osrm_matrices, get_osrm_route_geometry
from app.services.routing_engine import optimize_route_engine
from app.services.shelf_life_context import calculate_urgency
import math

router = APIRouter(prefix="/route", tags=["Route"])

@router.post("/optimize", response_model=RouteResponse)
def optimize_route(req: RouteRequest, db: Session = Depends(get_db)):
    kitchen = db.query(Kitchen).filter(Kitchen.id == req.kitchen_id).first()
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")
        
    # For demo purposes, the frontend is passing rescue_ids in req.delivery_ids
    # Let's fetch the rescue events directly
    rescue_events = db.query(RescueEvent).filter(RescueEvent.id.in_(req.delivery_ids)).all()
    if not rescue_events:
        raise HTTPException(status_code=404, detail="Rescue events not found")
        
    coordinates = [(kitchen.lat, kitchen.lng)]
    time_windows_seconds = [(0, 24 * 3600)] # Kitchen time window
    
    delivery_objects = []
    
    for rescue in rescue_events:
        # Just grab any active NGO for demo routing
        ngo = db.query(NGO).filter(NGO.is_active == True).first()
        if not ngo:
            continue
            
        category = db.query(FoodCategory).filter(FoodCategory.id == rescue.category_id).first()
        cat_name = category.name if category else "Rice"
        
        remaining_window_hours, _ = calculate_urgency(cat_name, rescue.batch_created_at)
        
        # Ensure max_time is at least 2 hours so VRPTW doesn't fail immediately
        max_time = max(2 * 3600, int(remaining_window_hours * 3600))
        time_windows_seconds.append((0, max_time))
        coordinates.append((ngo.lat, ngo.lng))
        
        # We don't have a real delivery object, so we'll pass None and the ngo
        delivery_objects.append((None, ngo))
        
    if len(coordinates) < 2:
        raise HTTPException(status_code=422, detail="Not enough valid deliveries to optimize")

    try:
        duration_matrix, distance_matrix = get_osrm_matrices(coordinates)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OSRM Error: {str(e)}")

    route_indices, total_dist_meters, total_dur_seconds, routing_method = optimize_route_engine(
        duration_matrix, distance_matrix, time_windows_seconds
    )

    if not route_indices:
        raise HTTPException(status_code=422, detail="Infeasible route due to time windows")
        
    ordered_waypoints = []
    ordered_coords = []
    
    for idx in route_indices:
        if idx == 0:
            ordered_waypoints.append(Waypoint(lat=kitchen.lat, lng=kitchen.lng, label=kitchen.name, type="kitchen"))
            ordered_coords.append((kitchen.lat, kitchen.lng))
        else:
            d, ngo = delivery_objects[idx - 1]
            ordered_waypoints.append(Waypoint(lat=ngo.lat, lng=ngo.lng, label=ngo.name, type="ngo"))
            ordered_coords.append((ngo.lat, ngo.lng))
            
    polyline_geojson = get_osrm_route_geometry(ordered_coords)
    
    total_distance_km = round(total_dist_meters / 1000.0, 2)
    eta_minutes = math.ceil(total_dur_seconds / 60.0)

    # fallback polyline if geojson fails or frontend prefers it
    # polyline should just be lat/lng pairs from ordered_coords
    route_polyline = []
    if polyline_geojson:
        # lineString coordinates are [lon, lat]
        route_polyline = [[c[1], c[0]] for c in polyline_geojson.get("coordinates", [])]
    else:
        # direct straight lines
        route_polyline = [[lat, lng] for lat, lng in ordered_coords]
        
    return RouteResponse(
        waypoints=ordered_waypoints,
        total_distance_km=total_distance_km,
        eta_minutes=eta_minutes,
        route_polyline=route_polyline,
        route_geometry=polyline_geojson,
        routing_method_used=routing_method
    )
