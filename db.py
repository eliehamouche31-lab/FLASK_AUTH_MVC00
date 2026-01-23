import os
import mysql
import pymysql
from pymysql.err import OperationalError
from config import connection_params     # NOW this works!


class DBConnection:
    def __init__(self):
        self.host = os.getenv("DB_HOST", "127.0.0.1")
        self.user = os.getenv("DB_USER", "root")
        self.password = os.getenv("DB_PASSWORD", "elie")
        self.database = os.getenv("DB_NAME", "auth_prjai")
        self.conn = None

    def connect(self):
        """Persistent connection with auto-reconnect."""
        try:
            if self.conn is None or not self.conn.open:
                self.conn = pymysql.connect(
                    host=self.host,
                    user=self.user,
                    password=self.password,
                    database=self.database,
                    cursorclass=pymysql.cursors.DictCursor,  # ✅ returns dicts
                    autocommit=True
                )
            return self.conn
        except OperationalError as e:
            print("❌ DBConnection error:", e)
            self.conn = None
            return None

    def get_connection():
        return mysql.connector.connect(**connection_params)



    def fetch_all(self, query, params=None):
        """Return list of dicts."""
        conn = self.connect()
        if not conn:
            return []
        with conn.cursor() as cursor:
            cursor.execute(query, params or ())
            return cursor.fetchall()  # already dicts

    def fetchone(self, query, params=None):
        """Return single dict or None."""
        conn = self.connect()
        if not conn:
            return None
        with conn.cursor() as cursor:
            cursor.execute(query, params or ())
            return cursor.fetchone()  # already dict

    def execute(self, query, params=None):
        """Execute INSERT/UPDATE/DELETE, returns lastrowid."""
        conn = self.connect()
        if not conn:
            return None
        with conn.cursor() as cursor:
            cursor.execute(query, params or ())
            conn.commit()
            return cursor.lastrowid

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None
            print("Connexion MySQL fermée.")
    
   