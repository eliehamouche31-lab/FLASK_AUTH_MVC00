import os
import pymysql
from models.db import DBConnection
from flask import jsonify

class CRUD:
    def __init__(self, table=None):
        self.db = DBConnection()
        self.connection = None
        self.cursor = None
        self.table_name = table

    def connect(self):
        if not self.connection or not self.connection.open:
            self.connection = self.db.connect()  # Appelle la connexion unique de DBConnection
            self.cursor = self.connection.cursor()
        return self.connection

    def table(self, table_name):
        self.table_name = table_name
        return self

    def select(self, columns="*"):
        self.connect()  # S’assure que la connexion est ouverte
        if isinstance(columns, list):
            columns = ", ".join(columns)
        query = f"SELECT {columns} FROM {self.table_name}"
        self.cursor.execute(query)
        return self.cursor.fetchall()
    
    def insert(self, data):
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["%s"] * len(data))
        values = tuple(data.values())
        query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"  # fix self.table → self.table_name
        self.cursor.execute(query, values)
        self.connection.commit()  # fix self.conn → self.connection
        return self.cursor.lastrowid

    def update(self, data, where, params=None):
        set_clause = ", ".join([f"{k}=%s" for k in data.keys()])
        values = tuple(data.values())
        query = f"UPDATE {self.table_name} SET {set_clause} WHERE {where}"  # fix self.table → self.table_name
        self.cursor.execute(query, values + (params or ()))
        self.connection.commit()  # fix self.conn → self.connection
        return self.cursor.rowcount

    def delete(self, where, params=None):
        query = f"DELETE FROM {self.table_name} WHERE {where}"  # fix self.table → self.table_name
        self.cursor.execute(query, params or ())
        self.connection.commit()  # fix self.conn → self.connection
        return self.cursor.rowcount
        
    
    
    def close_connection(self):
        try:
            if self.connection and self.connection.open:
                    self.connection.close()
        except pymysql.Error as e:
            print("Warning: Tried to close already closed connection", e)
        

# --------------------------- Helper function ---------------------------
def validate_required_fields(data: dict, required_fields: list):
    missing = [f for f in required_fields if f not in data or data[f] is None]
    if missing:
        return False, f"Missing required fields: {', '.join(missing)}"
    return True, None


# ------------------------ SELECT ------------------------

def f_select(table):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        return jsonify(rows), 200
    except Exception as e:
            return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

    # -------------------- SELECT with WHERE --------------------

def f_select_where(table, conditions: dict):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(dictionary=True)

        where_clause = " AND ".join([f"{col} = %s" for col in conditions.keys()])
        sql = f"SELECT * FROM {table} WHERE {where_clause}"
        cursor.execute(sql, tuple(conditions.values()))

        rows = cursor.fetchall()
        return jsonify(rows), 200
    except Exception as e:
            return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

def f_select_where_new(table, conditions: dict, columns="*"):
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(dictionary=True)
        if isinstance(columns, list):
            columns = ", ".join(columns)
        where_clause = " AND ".join([f"{col} = %s" for col in conditions.keys()])
        sql = f"SELECT {columns} FROM {table} WHERE {where_clause}"
        cursor.execute(sql, tuple(conditions.values()))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(rows), 200
        

# --------------------------- INSERT ---------------------------

def f_insert(table, data: dict):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor()

        cols = ", ".join(data.keys())
        placeholders = ", ".join(["%s"] * len(data))
        sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
        cursor.execute(sql, tuple(data.values()))

        conn.commit()
        return jsonify({"success": True, "message": "Record inserted successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# --------------------------- UPDATE ---------------------------

def f_update(table, record_id, data: dict, id_col="id"):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor()

        set_clause = ", ".join([f"{col} = %s" for col in data.keys()])
        sql = f"UPDATE {table} SET {set_clause} WHERE {id_col} = %s"
        cursor.execute(sql, tuple(data.values()) + (record_id,))

        conn.commit()
        return jsonify({"success": True, "message": "Record updated successfully"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# --------------------------- DELETE ---------------------------

def f_delete(table, record_id, id_col="id"):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute(f"DELETE FROM {table} WHERE {id_col} = %s", (record_id,))
        conn.commit()
        return jsonify({"success": True, "message": "Record deleted successfully"}), 200
    except Exception as e:
            conn.rollback()
            return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

 # ---------------------------close---------------------------    
    
def close(self):
    if self.connection:
        self.connection.close()
        self.connection = None
