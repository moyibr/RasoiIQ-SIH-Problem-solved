import os
import random
import datetime
import math
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set up DB connection before importing models
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.database import Base
# Import the whole models package so every table/foreign key is registered on
# Base.metadata before create_all() runs. Importing models one-by-one leaves
# FK targets (e.g. rescue_events -> users) unresolved and create_all() raises.
import app.models  # noqa: F401
from app.models.kitchen import Kitchen
from app.models.food_category import FoodCategory
from app.models.ngo import NGO
from app.models.consumption import ConsumptionLog
from app.models.production import ProductionLog
from app.models.rescue import RescueEvent
from app.models.sustainability import SustainabilityMetric

def seed_data():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    
    try:
        # Seed Kitchen
        kitchen = session.query(Kitchen).filter_by(name="BMTC Staff Canteen").first()
        if not kitchen:
            kitchen = Kitchen(
                name="BMTC Staff Canteen",
                address="BMTC Head Office, Shanthinagar, Bengaluru 560027",
                lat=12.9600,
                lng=77.5800,
                capacity_meals=800
            )
            session.add(kitchen)
            session.commit()
            
        # Seed Food Categories
        cats = [
            ("rice", 6.0), ("dal", 8.0), ("vegetable_curry", 6.0), 
            ("roti", 4.0), ("salad", 3.0), ("dessert", 12.0), 
            ("sambar", 6.0), ("milk", 24.0)
        ]
        cat_map = {}
        for name, shelf_life in cats:
            cat = session.query(FoodCategory).filter_by(name=name).first()
            if not cat:
                cat = FoodCategory(name=name, shelf_life_hours=shelf_life, is_vegetarian=True)
                session.add(cat)
                session.commit()
            cat_map[name] = cat
            
        # Seed NGOs
        ngos_data = [
            {"name": "Akshaya Patra Foundation", "lat": 12.9716, "lng": 77.5946, "food_preference": "veg", "capacity_kg": 50.0, "address": "Chord Road, Rajajinagar"},
            {"name": "Seva Sangha Trust", "lat": 12.9352, "lng": 77.6245, "food_preference": "either", "capacity_kg": 30.0, "address": "Koramangala 4th Block"},
            {"name": "Robin Hood Army Bengaluru", "lat": 12.9539, "lng": 77.6101, "food_preference": "either", "capacity_kg": 25.0, "address": "Indiranagar 100 Feet Road"},
            {"name": "Annadana Foundation", "lat": 12.9856, "lng": 77.5741, "food_preference": "veg", "capacity_kg": 40.0, "address": "Malleswaram 18th Cross"},
            {"name": "Namma Bengaluru Foundation", "lat": 12.9165, "lng": 77.5823, "food_preference": "nonveg", "capacity_kg": 20.0, "address": "JP Nagar 6th Phase"},
        ]
        for nd in ngos_data:
            ngo = session.query(NGO).filter_by(name=nd["name"]).first()
            if not ngo:
                ngo = NGO(**nd)
                session.add(ngo)
                session.commit()
                
        # Generate 6 months data (April 1 2026 to Sep 19 2026)
        start_date = datetime.date(2026, 4, 1)
        end_date = datetime.date(2026, 9, 19)
        delta = end_date - start_date
        
        base_qty = {
            "breakfast": {"rice": 8, "dal": 5, "vegetable_curry": 6, "roti": 10, "salad": 3, "dessert": 2, "sambar": 4, "milk": 8},
            "lunch": {"rice": 20, "dal": 12, "vegetable_curry": 15, "roti": 18, "salad": 6, "dessert": 5, "sambar": 10, "milk": 5},
            "dinner": {"rice": 15, "dal": 10, "vegetable_curry": 12, "roti": 14, "salad": 4, "dessert": 4, "sambar": 8, "milk": 4}
        }
        
        festivals = [datetime.date(2026, 4, 14), datetime.date(2026, 5, 1), datetime.date(2026, 6, 15), datetime.date(2026, 8, 15), datetime.date(2026, 8, 26), datetime.date(2026, 9, 2)]
        
        # Check if already seeded for this period to make idempotent
        existing = session.query(ConsumptionLog).filter(ConsumptionLog.date >= start_date, ConsumptionLog.date <= end_date).first()
        if existing:
            print("Logs already seeded.")
            return

        total_con = 0
        total_sur = 0

        for i in range(delta.days + 1):
            curr_date = start_date + datetime.timedelta(days=i)
            
            wd = curr_date.weekday()
            wd_mult = 1.0 if wd < 5 else (0.75 if wd == 5 else 0.60)
            
            fest_mult = 1.4 if curr_date in festivals else 1.0
            seas_mult = 1.0 + 0.08 * math.sin(math.pi * i / delta.days)
            
            daily_rescued = 0.0
            daily_wasted = 0.0
            
            for meal in ["breakfast", "lunch", "dinner"]:
                for cname, cat in cat_map.items():
                    base = base_qty[meal][cname]
                    noise = random.gauss(0, 0.05)
                    qty = base * wd_mult * fest_mult * seas_mult * (1 + noise)
                    headcount = int(qty / 0.35) if qty > 0 else 0
                    
                    clog = ConsumptionLog(kitchen_id=kitchen.id, category_id=cat.id, date=curr_date, meal_type=meal, quantity_kg=qty, headcount=headcount)
                    session.add(clog)
                    total_con += 1
                    
                    planned = qty * 1.12
                    actual = planned * random.uniform(0.95, 1.05)
                    
                    plog = ProductionLog(kitchen_id=kitchen.id, category_id=cat.id, date=curr_date, planned_kg=planned, actual_kg=actual)
                    session.add(plog)
                    
                    if actual > qty + 1.0:
                        rescue_qty = actual - qty
                        sl = cat.shelf_life_hours
                        urgency = 'critical' if sl <= 4 else ('high' if sl <= 6 else ('medium' if sl <= 8 else 'low'))
                        status = 'delivered' if (end_date - curr_date).days > 1 else 'pending'
                        
                        event_time = datetime.datetime.combine(curr_date, datetime.time(14 if meal=='lunch' else (20 if meal=='dinner' else 10)))
                        expiry_time = event_time + datetime.timedelta(hours=sl)
                        
                        sev = RescueEvent(kitchen_id=kitchen.id, category_id=cat.id, quantity_kg=rescue_qty, urgency_level=urgency, status=status, detected_at=event_time, batch_created_at=event_time, expiry_at=expiry_time)
                        session.add(sev)
                        total_sur += 1
                        
                        if status == 'delivered':
                            daily_rescued += rescue_qty
                        else:
                            daily_wasted += rescue_qty

            session.commit()
            
            if daily_rescued > 0 or daily_wasted > 0:
                sm = SustainabilityMetric(
                    date=curr_date,
                    kg_rescued=daily_rescued,
                    kg_wasted=daily_wasted,
                    co2_saved_kg=daily_rescued * 2.5,
                    meals_served=int(daily_rescued / 0.35),
                    cost_saved_inr=daily_rescued * 50
                )
                session.add(sm)
            session.commit()

        print(f"Seeded: 1 kitchens, 5 ngos, {total_con} consumption records, {total_sur} rescue events")
    
    except Exception as e:
        session.rollback()
        print(f"Error seeding: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    seed_data()
