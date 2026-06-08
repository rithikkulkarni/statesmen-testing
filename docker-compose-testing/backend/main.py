from fastapi import FastAPI
from psycopg2 import connect, extras
import os

app = FastAPI()

def get_db():
    return connect(
        host=os.getenv("DB_HOST", "db"),
        database=os.getenv("DB_NAME", "demo"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password")
    )

@app.on_event("startup")
def create_table():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

@app.get("/items")
def get_items():
    conn = get_db()
    cur = conn.cursor(cursor_factory=extras.RealDictCursor)
    cur.execute("SELECT * FROM items")
    items = cur.fetchall()
    conn.close()
    return items

@app.post("/items/{name}")
def add_item(name: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO items (name) VALUES (%s)", (name,))
    conn.commit()
    conn.close()
    return {"message": f"Added {name}"}