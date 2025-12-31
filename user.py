# models/user.py
import datetime
import os
import hashlib
import binascii
from werkzeug.security import generate_password_hash, check_password_hash
from flask import jsonify, make_response, request, session

import pymysql
from pymysql.err import OperationalError
from passlib.hash import scrypt
from models.db import DBConnection
from models.crud import CRUD

import uuid
from datetime import datetime, timedelta



class User:
    SESSION_DURATION_MIN = 20  # Durée de session TEMP_SESSION en minutes
    REGISTER_TOKEN_DURATION_MIN = 30   # Durée max pour finaliser l'inscription
 
     
    
    def __init__(self, user_id=None, username=None, email=None):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.role = None
        self._Nbinvoice = None
        self.db = DBConnection()
        self.connection = None
        self.cursor = None


    # =====================================================
    # Database Connection
    # =====================================================
    def connect(self):
        if not self.connection or not getattr(self.connection, "open", True):
            self.connection = self.db.connect()
            if self.connection:
                self.cursor = self.connection.cursor(pymysql.cursors.DictCursor)
        return self.connection

    def close_connection(self):
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        self.cursor = None
        self.connection = None

    # =====================================================
    # Session Management
    # =====================================================
    def _start_session(self, user: dict):
        # Set session values
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["email"] = user["email"]
        session["role"] = user.get("role", "client")
        session["admin_text"] = user["username"] if session["role"] == "admin" else ""

        # Set expiration cookie
        expiration = datetime.datetime.utcnow() + timedelta(minutes=self.SESSION_DURATION_MIN)
        response = make_response(jsonify({
            "success": True,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "role": session["role"],
                "admin_text": session["admin_text"]
            }
        }))
        response.set_cookie("TEMP_SESSION", str(user["id"]), expires=expiration, httponly=True)
        return response


# =====================================================
 # Login 
# =====================================================
    def login(self, email: str, password: str, role: str):
        try:
            self.connect()

            # Determine table
            table = "users" if role in ["client", "admin"] else "staff"
            id_field = "id" if table == "users" else "staff_id"

            self.cursor.execute(
                f"SELECT {id_field} AS id, username, email, role, password_hash FROM {table} WHERE email=%s",
                (email,)
            )
            user_record = self.cursor.fetchone()

            if not user_record:
                self.close_connection()
                return jsonify(success=False, message="User does not exist."), 404

            # Verify password using Werkzeug
            if not check_password_hash(user_record["password_hash"], password):
                self.close_connection()
                return jsonify(success=False, message="Incorrect password"), 401

            # Create Flask session
            session.permanent = True
            session["user_id"] = user_record["id"]
            session["username"] = user_record["username"]
            session["email"] = user_record["email"]
            session["role"] = user_record["role"]

            from flask import current_app
            current_app.permanent_session_lifetime = timedelta(minutes=30)

            self.close_connection()

            return jsonify(
                success=True,
                message=f"Welcome, {user_record['username']}!",
                user={
                    "id": user_record["id"],
                    "username": user_record["username"],
                    "email": user_record["email"],
                    "role": user_record["role"]
                }
            ), 200

        except Exception as e:
            self.close_connection()
            return jsonify(success=False, message=f"Login error: {str(e)}"), 500
    
    
    
    # -------------------------
    # User Login
    # -------------------------
    def _login(self, email, password):
        try:
            self.connect()
            self.cursor.execute("SELECT * FROM users WHERE email=%s", (email,))
            user = self.cursor.fetchone()
            if not user:
                return jsonify({"success": False, "message": "Email not found"})

            if not scrypt.verify(password, user["password"]):
                return jsonify({"success": False, "message": "Incorrect password"})

            return self._start_session(user, user.get("role", "client"))
        except Exception as e:
            return jsonify({"success": False, "message": str(e)})
        finally:
            self.close_connection()


# -------------------------------------------
# User Registration
# ---------------------------------------------
    
    def register(self, username, email, password, role):
        try:
            self.connect()
            self.cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
            if self.cursor.fetchone():
                return jsonify({"success": False, "message": "Email already registered"})

            # Hash du mot de passe
            hashed_pw = generate_password_hash(password)

            # Insertion
            self.cursor.execute(
                "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
                (username, email, hashed_pw, role)
            )
            self.connection.commit()

            # Récupérer l'ID auto-généré
            new_user_id = self.cursor.lastrowid

            return jsonify({
                "success": True,
                "message": f"User registered successfully with ID {new_user_id}",
                "user_id": new_user_id
            })

        except Exception as e:
            return jsonify({"success": False, "message": str(e)})
        finally:
            self.close_connection()
    
    
    def logout_session(self):
        session.clear()
        response = make_response(jsonify({"success": True, "message": "Session closed"}))
        response.set_cookie("TEMP_SESSION", "", expires=0)
        return response


    # =====================================================
    # Universal Query Dispatcher
    # =====================================================
    def get_query(self, entity, role, **params):
        """
        Sélectionne la requête à exécuter selon le rôle et l'entité.
        Retourne un JSON de données.
        """

        tabreq = [
            self.query_users,               # req0
            self.query_services,            # req1
            self.query_service_options,     # req2
            self.query_option_detail,       # req3
            self.query_type_service_option, # req4
            self.query_payment,             # req5
            self.query_invoice,             # req6
            self.query_staff,               # req7
            self.query_payment2,            # req8
            self.query_invoice2             # req9
        ]
  
        mapping = {
                "users": 0,
                "services": 1,
                "service_options": 2,
                "option_detail": 3,
                "type_service_option": 4,
                "payment": 5,
                "invoice": 6,
                "staff": 7,
                "payment2": 8,
                "invoice2": 9,
        }
    # Vérifie si l’entité est valide
        if entity not in mapping:
            return None

        idx = mapping[entity]

        # Logique selon le rôle
        if role == "client":
            if idx in [0, 1, 2, 3, 4, 5, 6]:
                return tabreq[idx]
        elif role == "admin":
            if idx in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]:
                return tabreq[idx]
        elif role == "staff":
            if idx in [7, 2, 8, 9]:
                return tabreq[idx]

        return None


    # =====================================================
    # Core Queries
    # =====================================================
    def query_users(self, user_id=None, **kwargs):
        sql = "SELECT id, username, email, fname, lname, role, sex, created_at FROM users WHERE id=%s"
        return self.db.fetch_all(sql, (user_id,))

    def query_services(self, user_id=None, **kwargs):
        sql = """SELECT s.service_id, s.service_name,  s.create_date, s.user_id, s.checked,s.icon_path
                 FROM services s WHERE s.user_id=%s"""
        return self.db.fetch_all(sql, (user_id,))

    def query_service_options(self, user_id=None, **kwargs):
        sql = """SELECT so.service_option_id, so.option_name,so.description,so.montant_value,so.type_payment, so.image, so.checked_option,so.link
                 FROM service_options so
                 JOIN services s ON s.service_id = so.service_id
                 WHERE s.user_id=%s"""
        return self.db.fetch_all(sql, (user_id,))

    def query_option_detail(self, user_id=None, **kwargs):
        sql = """SELECT od.option_detail_id,od.description, od.subscription_status, od.subscription_value,
                        od.payment_type, od.created_at, od.amount, od.tax_rate
                 FROM option_detail od
                 JOIN service_options so ON so.service_option_id = od.service_option_id
                 JOIN services s ON s.service_id = so.service_id
                 WHERE s.user_id=%s"""
        return self.db.fetch_all(sql, (user_id,))

    def query_type_service_option(self, **kwargs):
        sql = "SELECT type_ser_opt_id,name,description,price,is_active,created_at FROM type_service_option"
        return self.db.fetch_all(sql)

    def query_payment(self, user_id=None, **kwargs):
        sql = """SELECT p.payid, p.amount, p.currency, p.payment_method,
                p.payment_status,p.pay_date, p.created_at,
                s.subscription_value,s.payment_type,s.tax_rate
                FROM payment p
                JOIN option_detail s ON s.option_detail_id = p.option_detail_id
                WHERE s.user_id = %s"""
        return self.db.fetch_all(sql, (user_id,))


    def query_invoice(self, user_id=None, **kwargs):
        if not user_id:
            raise ValueError("user_id required")
        sql = """
            SELECT i.InvoiceNb_id, i.ClientID, i.InvoiceDate, i.PaymentDate, 
                   i.TaxAmount, i.amount, i.paid, i.status, i.due_date,
                   od.description, od.subscription_value
            FROM users u
            JOIN option_detail od ON od.user_id = u.id
            JOIN invoice i ON i.ClientID = u.id
            WHERE u.id = %s
            ORDER BY i.InvoiceDate ASC
        """
        return self.db.fetch_all(sql, (user_id,))

  
    def get_invoice_byNb_C(self, username=None, email=None, Nbinvoice=None):
        if not username or not email or not Nbinvoice:
            raise ValueError("Username, email, and Invoice Nb are required")

        # Lookup user ID
        sql_user = "SELECT id FROM users WHERE username=%s AND email=%s"
        user = self.db.fetch_one(sql_user, (username, email))
        if not user:
            return []  # or raise an error

        user_id = user["id"]

        # Fetch invoice by number
        sql = """
            SELECT 
                i.InvoiceNb_id,
                i.ClientID,
                i.InvoiceDate,
                i.PaymentDate,
                i.TaxAmount,
                i.amount,
                i.paid,
                i.status,
                i.due_date,
                od.description,
                od.subscription_value,
                od.payment_type
            FROM users u
            JOIN option_detail od ON od.user_id = u.id
            JOIN invoice i ON i.ClientID = od.user_id
            WHERE u.role = 'client' AND u.id = %s AND i.InvoiceNb_id = %s
            ORDER BY i.InvoiceDate ASC
        """
        return self.db.fetch_all(sql, (user_id, Nbinvoice))

 

    def query_staff(self, staff_id=None, **kwargs):
        sql = "SELECT staff_id, fname, lname, position,role,salary, phone,email,is_active, service_id  FROM staff WHERE staff_id=%s"
        return self.db.fetch_all(sql, (staff_id,))
 
    def query_payment2(self, staff_id=None, **kwargs):
        sql = """SELECT pay_sid, service_option_id, amount, currency, payment_method,
                        payment_status, pay_date, created_at
                 FROM payment2  
                 WHERE service_option_id IN (
                     SELECT service_option_id FROM service_options
                     WHERE staffid=%s
                 )"""
        return self.db.fetch_all(sql, (staff_id,))

    def query_invoice2(self, staff_id=None, **kwargs):
        sql = """SELECT InvoiceStNb_id,StaffID,InvoiceDate,PaymentDate,TaxAmount,
                Amount,Status,Due_date,Service_id
                 FROM invoice2
                 WHERE StaffID=%s"""
        return self.db.fetch_all(sql, (staff_id,))

# =====================================================
# Filtering for Dashboard (MagicTab)
# =====================================================
    def filter_entities(self, role, entity, username=None, email=None, fname=None, lname=None):
        try:
            self.connect()
            user_id = None
            staff_id = None

            # --- Récupération ID client ---
            if role == "client" and username and email:
                self.cursor.execute(
                    "SELECT id FROM users WHERE username=%s AND email=%s AND role=%s",
                    (username, email, role)
                )
                row = self.cursor.fetchone()
                if row:
                    user_id = row["id"]

            # --- Récupération ID admin ---
            if role == "admin" and username and email:
                self.cursor.execute(
                    "SELECT id FROM users WHERE username=%s AND email=%s AND role=%s",
                    (username, email, role)
                )
                row = self.cursor.fetchone()
                if row:
                    user_id = row["id"]

            # --- Récupération ID staff ---
            if role == "staff" and fname and lname:
                self.cursor.execute(
                    "SELECT staff_id FROM staff WHERE fname=%s AND lname=%s",
                    (fname, lname)
                )
                row = self.cursor.fetchone()
                if row:
                    staff_id = row["staff_id"]

            # --- Récupération de la fonction de requête ---
            query_func = self.get_query(entity, role)
            if not query_func:
                return {"success": False, "data": [], "message": f"Aucune requête trouvée pour {role}/{entity}"}

            # --- Exécution de la requête ---
            if role == "staff":
                result = query_func(staff_id=staff_id)
            else:
                result = query_func(user_id=user_id)

            # Ensure result is always a list
            if result is None:
                result = []

            self.close_connection()
            message = "" if result else f"Aucun résultat trouvé pour {role}"
            return {"success": True, "data": result, "message": message}

        except Exception as e:
            self.close_connection()
            return {"success": False, "data": [], "message": str(e)}
    
# ---------------  query invoice client--------------------------
    def query_invoice_C(self, username, email):
            """
            Fetch all invoices for a given client by username and email.
            """
            db = DBConnection()
            conn = db.connect()
            cursor = None

            try:
                if not username or not email:
                    raise ValueError("Username and email are required")

                cursor = conn.cursor(pymysql.cursors.DictCursor)

                query = """
                    SELECT 
                        i.InvoiceNb_id,
                        i.ClientID,
                        i.InvoiceDate,
                        i.PaymentDate,
                        i.TaxAmount,
                        i.Amount,
                        i.Status,
                        i.Due_date,
                        od.description,
                        od.subscription_value,
                        od.payment_type,
                        u.username,
                        u.email
                    FROM users u
                    JOIN option_detail od ON od.user_id = u.id
                    JOIN invoice i ON i.ClientID = u.id
                    WHERE u.role = 'client'
                    AND u.username = %s 
                    AND u.email = %s
                """

                cursor.execute(query, (username, email))
                data = cursor.fetchall()
                return data

            except Exception as e:
                print("❌ Error in query_invoice (client):", e)
                raise

            finally:
                if cursor:
                    cursor.close()
                if conn:
                    conn.close()




# =====================================================
# Filtering by users and invoices
# =====================================================
    def filter_users(self, role, entity, username, email, fname, lname):
        try:
            self.connect()
            user_id = None
            staff_id = None

            # --- Récupération ID client ---
            if role == "client" and username and email:
                self.cursor.execute(
                    "SELECT id FROM users WHERE username=%s AND email=%s AND role=%s",
                    (username, email, role)
                )
                row = self.cursor.fetchone()
                if row:
                    user_id = row["id"]

            # --- Récupération ID admin ---
            if role == "admin" and username and email:
                self.cursor.execute(
                    "SELECT id FROM users WHERE username=%s AND email=%s AND role=%s",
                    (username, email, role)
                )
                row = self.cursor.fetchone()
                if row:
                    user_id = row["id"]

            # --- Récupération ID staff ---
            if role == "staff" and fname and lname:
                self.cursor.execute(
                    "SELECT staff_id FROM staff WHERE fname=%s AND lname=%s",
                    (fname, lname)
                )
                row = self.cursor.fetchone()
                if row:
                    staff_id = row["staff_id"]

            # --- Récupération de la fonction de requête ---
            print("❌  query_invoice values :", role,entity,username,email,result)
            query_func_inv = self.get_query_invoices(entity, role)
            if not query_func_inv:
                return {"success": False, "data": [], "message": f"Aucune requête trouvée pour {role}/{entity}"}

            # --- Exécution de la requête ---
            if role == "staff":
                result = query_func_inv(staff_id=staff_id)
            else:
                result = query_func_inv(user_id=user_id)

            # Ensure result is always a list
            if result is None:
                result = []
                print("❌  query_invoice values :", role,entity,username,email,result)

            self.close_connection()
            message = "" if result else f"Aucun résultat trouvé pour {role}"
            return {"success": True, "data": result, "message": message}

        except Exception as e:
            self.close_connection()
            return {"success": False, "data": [], "message": str(e)}
    

#-------- get query invoices  ------------------------------------- 
    def get_query_invoices(self, entity, role, **params):
            """
            Sélectionne la requête à exécuter selon le rôle et l'entité.
            Retourne un JSON de données.
            """
            tabreq = [
                self.query_users,               # req0         
                self.query_invoice,             # req6
                self.query_staff,               # req7
                self.query_invoice2             # req9
            ]
    
            mapping = {
                    "users": 0,
                    "invoice": 1,
                    "staff": 2,
                    "invoice2": 3,
            }
        # Vérifie si l’entité est valide
            if entity not in mapping:
                return None

            idx = mapping[entity]

            # Logique selon le rôle
            if role == "client":
                if idx in [0, 1]:
                    return tabreq[idx]
            elif role == "admin":
                if idx in [0, 1, 2, 3]:
                    return tabreq[idx]
            elif role == "staff":
                if idx in [2,3]:
                    return tabreq[idx]
            return None

    

    def get_current_user(user_id):
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor()  # DictCursor is already set in DBConnection
        try:
            sql = """
                SELECT 
                id, username, email, role, sex, created_at
                FROM users
                WHERE id = %s
            """
            cursor.execute(sql, (user_id,))
            result = cursor.fetchone()
            if not result:
                return None
            return result
        finally:
            cursor.close()
            conn.close()


#---------------------------------------------------------
    
    def _get_user_id(self, username, email):
        """Retrieve user_id from username/email."""
        self.connect()
        try:
            self.cursor.execute(
                "SELECT id FROM users WHERE username=%s AND email=%s",
                (username, email)
            )
            row = self.cursor.fetchone()
            return row["id"] if row else None
        finally:
            self.close_connection()

    # -------------------------
    # start session user
    # -------------------------      

    def _start_session(self, data: dict, role="client"):
        """Start a session for a user."""
        session["user_id"] = data["id"]
        session["username"] = data["username"]
        session["email"] = data["email"]
        session["role"] = role
        session["admin_text"] = data["username"] if role == "admin" else ""

        expiration = datetime.datetime.utcnow() + timedelta(minutes=self.SESSION_DURATION_MIN)
        response = make_response(jsonify({
            "success": True,
            "user": {
                "id": data["id"],
                "username": data["username"],
                "email": data["email"],
                "role": role,
                "admin_text": session["admin_text"]
            }
        }))
        response.set_cookie("TEMP_SESSION", str(data["id"]), expires=expiration, httponly=True)
        return response



    def _query_invoices_by_user(self, user_id, Nbinvoice=None):
        """Internal helper to fetch invoices for a user."""
        if not user_id:
            return []

        sql = """
            SELECT 
                i.InvoiceNb_id,
                i.ClientID,
                i.InvoiceDate,
                i.PaymentDate,
                i.TaxAmount,
                i.amount,
                i.paid,
                i.status,
                i.due_date,
                od.description,
                od.subscription_value,
                od.payment_type
            FROM users u
            JOIN option_detail od ON od.user_id = u.id
            JOIN invoice i ON i.ClientID = u.id
            WHERE u.id = %s
        """
        params = [user_id]
        if Nbinvoice:
            sql += " AND i.InvoiceNb_id = %s"
            params.append(Nbinvoice)
        sql += " ORDER BY i.InvoiceDate ASC;"
        return self.db.fetch_all(sql, tuple(params))

  
    # -------------------------
    # Invoice Retrieval
    # -------------------------
    def get_invoices(self, username, email):
        user_id = self._get_user_id(username, email)
        return self._query_invoices_by_user(user_id)

    def get_invoice_by_number(self, username, email, Nbinvoice):
        user_id = self._get_user_id(username, email)
        return self._query_invoices_by_user(user_id, Nbinvoice)
 




























    # =====================================================
    # Getters / Setters
    # =====================================================
    @property
    def user_id(self): return self._user_id
    @user_id.setter
    def user_id(self, value): self._user_id = value

    @property
    def username(self): return self._username
    @username.setter
    def username(self, value): self._username = value

    @property
    def email(self): return self._email
    @email.setter
    def email(self, value): self._email = value

    @property
    def fname(self): return self._fname
    @fname.setter
    def fname(self, value): self._fname = value

    @property
    def lname(self): return self._lname
    @lname.setter
    def lname(self, value): self._lname = value

    @property
    def sex(self): return self._sex
    @sex.setter
    def sex(self, value): self._sex = value

    @property
    def datebirth(self): return self._datebirth
    @datebirth.setter
    def datebirth(self, value): self._datebirth = value

    @property
    def address(self): return self._address
    @address.setter
    def address(self, value): self._address = value

    @property
    def role(self): return self._role
    @role.setter
    def role(self, value): self._role = value

    @property
    def created_at(self): return self._created_at
    @created_at.setter
    def created_at(self, value): self._created_at = value
    
    