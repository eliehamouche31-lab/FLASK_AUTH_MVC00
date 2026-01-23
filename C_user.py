# controllers/C_user.py
import io
import os
import datetime
from ssl import Purpose
from flask import Blueprint, Response, abort, json, redirect, render_template, request, jsonify, session, url_for,send_file, request
import pymysql
from controllers.auth_popup  import current_user
from models.db import DBConnection

from fpdf import FPDF  # ou pdfkit si tu préfères HTML → PDF
import smtplib
from email.message import EmailMessage
from models.crud import CRUD, f_select, f_insert, f_update, f_delete, f_select_where, f_select_where_new, validate_required_fields
from functools import wraps

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import pymysql

 
from flask_login import login_user, current_user, logout_user
from models.LoginUser import LoginUser
from models.user import User
from models.staff import Staff  # if separate staff table
from models.userservice  import UserService
from models.service   import  Service
from models.option   import  Option

from flask_login import login_required, current_user
 
from models.Repository  import find_by_user_id
from config import connection_params 
 
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


from flask import current_app
from werkzeug.utils import secure_filename

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "eliehamouche@hotmail.com"
SMTP_PASS = "elie"


UPLOAD_FOLDER = "static/uploads/emails"
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "docx"}
  

user_bp = Blueprint("C_user", __name__, url_prefix="/user")
user_model = User()
service_model = Service() 
option_model = Option() 
crud_model = CRUD()  


ALLOWED_TABS = {
    "cl_users_tab": "users",
    "cl_services_tab": "services",
    "cl_serviceoptions_tab": "service_options",
    "cl_optiondetails_tab": "option_detail",
    "cl_payments_tab": "payment",
    "cl_invoices_tab": "invoice",
    "cl_accounts_tab": "accounts",
    "cl_transactions_tab": "transactions",
    "cl_emails_tab": "emails",
    "cl_feedbacks_tab": "feedbacks"
}

  

@user_bp.route("/partials/<tab>")
def load_tab(tab):
    if tab not in ALLOWED_TABS:
        abort(404)

    table_name = ALLOWED_TABS[tab]

    db = DBConnection()
    conn = db.connect()
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template(
        f"partials/Client/{tab}.html",
        data=rows   # ✅ ALWAYS the same variable
    )

# ----------------- LOGIN Route -----------------
@user_bp.route("/login", methods=["POST"])
def login_route():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password required"}), 400

    # Try users table first
    user_obj = User()
    user_data = user_obj.verify_credentials(email, password, role=None)  # role=None means auto-detect
    if not user_data:
        # Try staff table
        staff_obj = Staff()
        user_data = staff_obj.verify_credentials(email, password)
        if not user_data:
            return jsonify({"success": False, "message": "Invalid email or password"}), 401

    # Successful login
    login_user(LoginUser(user_data))
    session.update({
        "user_id": user_data["id"],
        "username": user_data["username"],
        "email": user_data["email"],
        "role": user_data["role"].lower(),  # important!
        "staff_id": user_data.get("id") if user_data["role"].lower() == "staff" else None
    })
    session.permanent = True

    return jsonify({"success": True, "user": user_data}), 200

# ----------------- REGISTER Route -----------------
@user_bp.route("/register", methods=["POST"])
def register_route():
    data = request.get_json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "client").lower()

    if not all([username, email, password, role]):
        return jsonify({"success": False, "message": "All fields required"}), 400

    user_obj = User()
    return user_obj.register(username, email, password, role)

 
# ----------------- LOGIN route-----------------
@user_bp.route("/loginRoute", methods=["POST"], endpoint="user_login")
def login_userroute():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "client")

    result = user_model.login(email=email, password=password, role=role)
    if result[1] == 200:  # status_code
        user_data = result[0].json['user']
        session.update({
            "user_id": user_data['id'],
            "username": user_data['username'],
            "email": user_data['email'],
            "role": user_data['role']
        })
        session.permanent = True
    return result

  
# ----------------- LOGOUT -----------------
@user_bp.route("/logout", methods=["POST"], endpoint="user_logout")
def logout_user():
    return user_model.logout_session()


# ----------------- GET USERS -----------------
@user_bp.route("/get", methods=["GET"])
def get_users():
    user_id = request.args.get("id")
    return user_model.get_users(user_id)



# ----------------- UPDATE -----------------
@user_bp.route("/update/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400
    return user_model.update_user(user_id, data)


# ----------------- DELETE -----------------
@user_bp.route("/delete/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    return user_model.delete_user(user_id)

 

# ----------------- FETCH ENTITY -----------------
@user_bp.route("/dashboard/fetch-entity", methods=["GET"])
def fetch_entity():
    if "user_id" not in session:
        return jsonify(success=False, message="Session expired"), 401
    entity = request.args.get("entity")
    username = session.get("username")
    email = session.get("email")
    role = session.get("role")
    return jsonify(user_model.filter_entities(role, entity, username=username, email=email))



@user_bp.route("/get-user-id", methods=["GET"])
def get_user_id():
    username = request.args.get("username")
    email = request.args.get("email")

    if not username or not email:
        return jsonify(success=False, message="Username et email requis"), 400

    query = """
        SELECT id, username, email, fname, lname, role
        FROM users
        WHERE username = %s AND email = %s
        LIMIT 1
    """

    try:
        db = DBConnection()
        result = db.query_one(query, (username, email))
        if not result:
            return jsonify(success=False, message="Utilisateur non trouvé"), 404

        # Adapter pour le JSON
        user_json = {
            "id": result["id"],
            "username": result["username"],
            "email": result["email"],
            "fname": result.get("fname", ""),
            "lname": result.get("lname", ""),
            "role": result.get("role", "")
        }

        return jsonify(success=True, user=user_json)

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
 

@user_bp.route("/current_user")
def current_user_json():
    us = User()
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(None)  # or {} if you prefer
    user = us.get_current_user(user_id)
    return jsonify(user)


# ----------------- current user info -----------------
@user_bp.route("/current_user_info")
def current_user_info():
    return jsonify({
        "id": session.get("user_id"),
        "username": session.get("username"),
        "email": session.get("email"),
        "role": session.get("role")
    })


#   Route: /get_session_user — renvoie infos utilisateur
@user_bp.route("/get_session_user", methods=["GET"])
def get_session_user():
    try:
        # On récupère les paramètres GET (ou session plus tard)
        username = request.args.get("username", "")
        email = request.args.get("email", "")
        role = request.args.get("role", "")

        # Log console (pour debug)
        print(f"👤 Session user fetched → username={username}, email={email}, role={role}")

        # Vérification minimale
        if not username or not email:
            return jsonify({
                "success": False,
                "message": "Missing user credentials"
            }), 400

        # Simulation d’un utilisateur connecté
        user_data = {
            "username": username,
            "email": email,
            "role": role
        }

        return jsonify({
            "success": True,
            "user": user_data
        }), 200

    except Exception as e:
        print(f"❌ Error fetching session user: {e}")
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


@user_bp.route("/menu-toggle-content", methods=["GET"])
def menu_toggle_content():
    if "user_id" not in session:
        return "", 401

    # Rendu du template avec les informations de session
    return render_template(
        "partials/menu_toggle_content.html",
        username=session['username'],
        email=session['email'],
        role=session['role'],
        user_id=session['user_id']
    )

 

# -------------------------
# SERVICES
# -------------------------
@user_bp.route("/services_old", methods=["GET"])
def get_client_services_old():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "No active session"}), 401
    try:
        cq = user_model()
        services = cq.query_services(user_id=user_id)
        return jsonify({"success": True, "data": services}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------
# SERVICE OPTIONS
# -------------------------
@user_bp.route("/service-options/<int:user_id>", methods=["GET"])
def get_service_options_for_user(user_id):
    try:
        u = User()
        options = u.query_service_options(user_id=user_id)
        return jsonify(success=True, data=options)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500  

# -------------------------
# OPTION DETAILS
# -------------------------
@user_bp.route("/option_detail", methods=["GET"])
def get_client_option_detail():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "No active session"}), 401
    try:
        cq = user_model()
        details = cq.query_option_detail(user_id=user_id)
        return jsonify({"success": True, "data": details}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------
# PAYMENTS
# -------------------------
@user_bp.route("/payments", methods=["GET"])
def get_client_payments():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "No active session"}), 401
    try:
        cq = user_model()
        payments = cq.query_payment(user_id=user_id)
        return jsonify({"success": True, "data": payments}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------
# INVOICES
# -------------------------
@user_bp.route("/invoices", methods=["GET"])
def get_client_invoices():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "No active session"}), 401
    try:
        cq = user_model()
        invoices = cq.query_invoice(user_id=user_id)
        return jsonify({"success": True, "data": invoices}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# -------------------------
# EMAILS & FEEDBACKS
# -------------------------
@user_bp.route("/emails", methods=["GET"])
def get_client_emails():
    user_id = session.get("user_id")
    # TODO: implement your email query
    return jsonify({"success": True, "data": []})

@user_bp.route("/feedbacks", methods=["GET"])
def get_client_feedbacks():
    user_id = session.get("user_id")
    # TODO: implement your feedback query
    return jsonify({"success": True, "data": []})


@user_bp.route("/users", methods=["GET"])
def get_client_users():
    cq = User()   # now it’s correct, this creates a new instance
    users = cq.query_users(user_id=session["user_id"])
    return jsonify(success=True, data=users)


# ----------------------------------------------------------------
@user_bp.route("/<int:user_id>", methods=["GET"])
def get_user_by_id(user_id):
    try:
        cq = User()  # ⚡ Must create an instance, not just reference the class
        user = cq.query_users(user_id=user_id)
        if user:
            return jsonify(success=True, data=user[0])  # wrap in "success/data" for consistency
        return jsonify(success=False, data={}), 404
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


 
  
# ----------------------UserService------------------------------------------   
 

@user_bp.route("/menu-item", methods=["POST"])
@login_required
def menu_item():
    payload = request.json
    item = payload.get("item")
    user_service = UserService(current_user)  # current_user comes from Flask-Login
    data = user_service.get_item(item)
    return jsonify({"data": data})

# ------------------------------
# Get client services (checked=1)
# ------------------------------
@user_bp.route("/services", methods=["GET"])
def get_cl_services():
    type_service = request.args.get("type_service")  # optional
    service = UserService(current_user, type_service)
    data = service.get_checked_services()
    return jsonify({"data": data})

# ------------------------------
# Get direct option details
# ------------------------------
@user_bp.route("/option-details", methods=["GET"])
def get_client_option_details():
    service = UserService(current_user)
    data = service.get_direct_option_details()
    return jsonify({"data": data})

# ------------------------------
# Get details for a specific option
# ------------------------------
@user_bp.route("/option-details/<int:option_id>", methods=["GET"])
def get_option_details(option_id):
    service = UserService(current_user)
    data = service.get_option_details(option_id)
    return jsonify({"data": data})

# ------------------------------
# Update option detail
# ------------------------------
@user_bp.route("/option-details/<int:detail_id>", methods=["PUT"])
def update_option_detail(detail_id):
    payload = request.json
    new_value = payload.get("value")
    service = UserService(current_user)
    result = service.update_option_detail(detail_id, new_value)
    return jsonify(result)

# ------------------------------
# Delete option detail
# ------------------------------
@user_bp.route("/option-details/<int:detail_id>", methods=["DELETE"])
def delete_option_detail(detail_id):
    service = UserService(current_user)
    result = service.delete_option_detail(detail_id)
    return jsonify(result)


 
# ------------------------------
# search by user_id
# -----------------------------
@user_bp.route("/users", methods=["GET"])
@login_required
def get_users_list():   # rename from get_users to get_users_list
    data = find_by_user_id(
        current_user.id,
        connection_params,
        limit=20,
        offset=0
    )
    return jsonify(data)


#--------------helper ------------------
# List of all fields you want to appear in JSON
USER_FIELDS = [
    "id", "username", "email", "password_hash", "created_at",
    "fname", "lname", "sex", "datebirth", "phone", "address",
    "comments", "role"
]

# Function to make sure all fields exist and are formatted
def clean_user_data(user):
    cleaned = {}
    for k in USER_FIELDS:
        v = user.get(k) if user else None  # safe even if user is None
        if v is None:
            cleaned[k] = ""  # default empty string
        elif isinstance(v, (datetime.date, datetime.datetime)):
            cleaned[k] = v.isoformat()  # convert dates to string
        else:
            cleaned[k] = v
    return cleaned



@user_bp.route("/<int:user_id>", methods=["GET"])
def get_user(user_id):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT id, username, email, password_hash, created_at, fname, lname,
                   sex, datebirth, phone, address, comments, role
            FROM users
            WHERE id = %s
        """, (user_id,))
        user = cursor.fetchone()  # fetch one row as dict
        cursor.close()
        conn.close()

        if not user:
            return jsonify({"success": False, "error": "User not found"}), 404
        user_clean = clean_user_data(user)
        return jsonify({"success": True, "data": user_clean})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    
#------------get client  --> me -----------
@user_bp.route("/me", methods=["GET"])
@login_required
def get_current_user():
    return jsonify({
        "success": True,
        "data": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "role": current_user.role
        }
    })

#------------get client services ----------- 
@user_bp.route("/client/<int:user_id>/services", methods=["GET"])
@login_required
def get_client_service(user_id):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper part: Client ---
        cursor.execute("""
            SELECT id, username, email, created_at, fname, lname, sex, datebirth, phone, role
            FROM users
            WHERE id = %s
        """, (user_id,))
        users = cursor.fetchall()

        # --- Lower part: checked services ---
        cursor.execute("""
            SELECT service_id, service_name, create_date, user_id, checked, icon_path
            FROM services
            WHERE user_id = %s AND checked='1'
        """, (user_id,))
        services = cursor.fetchall()

        print("DEBUG services raw:", services)
        print("DEBUG type:", type(services))
        
        for service in services:
            print(
                f"🛠 service fetched → "
                f"service_name={service.get('service_name')}, "
                f"user_id={service.get('user_id')}, "
                f"checked={service.get('checked')}"
            )
        cursor.close()
        conn.close()

        return jsonify({"success": True, "data": services})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    


# ---------------- Update checked_option ----------------
@user_bp.route("/client/serviceoption_update/<int:option_id>/update", methods=["POST"])
@login_required
def update_service_option(option_id):
    try:
        new_checked = request.json.get("checked_option", "0")  # expected '0' or '1'
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            UPDATE service_options
            SET checked_option=%s
            WHERE service_option_id=%s
        """, (new_checked, option_id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ---------------- Delete service_option----------------
@user_bp.route("/client/serviceoption_delete/<int:option_id>/delete", methods=["POST"])
@login_required
def delete_service_option(option_id):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            UPDATE service_options
            SET checked_option='0'
            WHERE service_option_id=%s
        """, (option_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
 


#--------- page1 : GET /user/profile------------------------------------
@user_bp.route("/profile", methods=["GET"])
@login_required
def get_user_profile():
    try:
        user_id = current_user.id

        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT id, username, email, fname, lname, sex,
                   datebirth, phone,created_at, address, comments, role
            FROM users
            WHERE id = %s
        """, (user_id,))

        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if not user:
            return jsonify(success=False, message="User not found"), 404

        return jsonify(success=True, data=user)  # make sure all fields exist

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500
    
    
#--------- PUT /user/profile--------------------------------------
@user_bp.route("/profile_update", methods=["PUT"])
@login_required
def update_user_profile():
    data = request.json or {}
    if not data:
        return jsonify(success=False, message="No data provided"), 400

    try:
        user_id = current_user.id
        return user_model.update_user(user_id, data)

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500

#----------------- Page 2: subscribe / unsubscribe services   ----------------
 
@user_bp.route("/client/<int:user_id>/services", methods=["GET"])
@login_required
def get_client_services(user_id):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper part: Client ---
        cursor.execute("""
            SELECT id, username, email, created_at, fname, lname, sex, datebirth, phone, role
            FROM users
            WHERE id = %s
        """, (user_id,))
        users = cursor.fetchall()

        # --- Lower part: services ---       
        cursor.execute("""
            SELECT service_id, service_name,create_date, checked, icon_path 
            FROM services
            WHERE user_id = %s  
        """, (user_id,))
        services = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "users": users,
            "services": services
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
 

#----------------- POST /client/services  -------------------------
@user_bp.route("/client/services_update", methods=["POST"])
@login_required
def update_services():
    payload = request.json or {}
    service_id = payload.get("service_id")
    checked = payload.get("checked")

    if service_id is None or checked not in ("0", "1"):
        return jsonify(success=False, message="Invalid payload"), 400

    try:
        user_id = current_user.id

        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE services
            SET checked = %s
            WHERE service_id = %s AND user_id = %s
        """, (checked, service_id, user_id))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify(success=True)

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500
    

# ---------------- page3: /client/serviceswithoptions ----------------
@user_bp.route("/client/<int:user_id>/serviceswithoptions", methods=["GET"])
@login_required
def get_client_serviceswithoptions(user_id):  # <-- accept the argument
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper section: services ---
        cursor.execute("""
            SELECT service_id, service_name, create_date, checked, icon_path
            FROM services
            WHERE user_id = %s
        """, (user_id,))
        services = cursor.fetchall()

        # --- Lower section: service options ---
        cursor.execute("""
            SELECT so.service_id, so.service_option_id, so.type_ser_opt_id,
                   so.option_name, so.description, so.montant_value,
                   so.type_payment, so.image, so.link, so.checked_option
            FROM service_options so
            JOIN services s ON s.service_id = so.service_id
            WHERE s.user_id = %s
        """, (user_id,))
        service_options = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(success=True, services=services, options=service_options)

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500
 
#---------------- PUT /client/service-options -------------------
@user_bp.route("/client/serviceoptions_update", methods=["PUT"])
@login_required
def update_serviceoptions():
    payload = request.json or {}

    service_option_id = payload.get("service_option_id")
    checked_option = payload.get("checked_option")

    if service_option_id is None or checked_option not in ("0", "1"):
        return jsonify(success=False, message="Invalid payload"), 400

    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE service_options
            SET checked_option = %s
            WHERE service_option_id = %s
        """, (checked_option, service_option_id))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify(success=True)

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


# Deactivate service (client cannot delete)
@user_bp.route("/client/service/<int:service_id>/deactivate", methods=["POST"])
@login_required
def deactivate_service(service_id):
    try:
        service = service_model.deactivate(service_id)  # performs SQL UPDATE checked=0
        if not service:
            return jsonify(success=False, error="Service not found")
        return jsonify(success=True, message="Service deactivated successfully!")
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


# Deactivate service option (client cannot delete)
@user_bp.route("/client/serviceoption/<int:option_id>/deactivate", methods=["POST"])
@login_required
def deactivate_serviceoption(option_id):
    try:
        opt = option_model.deactivate(option_id)  # performs SQL UPDATE checked_option=0
        if not opt:
            return jsonify(success=False, error="Option not found")
        return jsonify(success=True, message="Service option deactivated successfully!")
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500
    

# ---------------- page4: service option/ details ----------------
@user_bp.route("/client/<int:user_id>/serviceoptionswithdetails", methods=["GET"])
def get_serviceoptionswithdetails(user_id):
    try:
        db = DBConnection()       # initialize your DB helper
        conn = db.connect()       # get a connection
        cursor = conn.cursor(pymysql.cursors.DictCursor) 
        # Upper part: service_options
        cursor.execute("""
            SELECT service_option_id, service_id, option_name, type_ser_opt_id,
                   description, montant_value, type_payment, image, link, checked_option
            FROM service_options
            WHERE checked_option = '1'
            ORDER BY service_option_id asc
        """)
        service_options = cursor.fetchall()

        # Lower part: option_detail
        cursor.execute("""
           SELECT 
            od.option_detail_id,
            od.service_option_id,
            od.user_id,
            od.description,
            od.subscription_status,
            od.subscription_value,
            od.payment_type,
            od.created_at,
            od.amount,
            od.tax_rate,
            od.InvoiceNb_id
            FROM service_options AS so
            JOIN option_detail AS od
                ON so.service_option_id = od.service_option_id
            WHERE od.user_id = %s
            ORDER BY od.option_detail_id ASC;
        """, (user_id,))
        option_details = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "service_options": service_options,
            "option_details": option_details
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
 



 # ---------------- page5: option detail/ payment ----------------
@user_bp.route("/client/<int:user_id>/optionsdetailwithpayments", methods=["GET"])
def get_optiondetailwithpayments(user_id):
    try:
        db = DBConnection()  # initialize your DB helper
        conn = db.connect()  # get a connection
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper part: Option Detail ---
        cursor.execute("""
            SELECT option_detail_id, service_option_id, user_id, description,
                   subscription_status, subscription_value, payment_type,
                   created_at, amount, tax_rate, InvoiceNb_id
            FROM option_detail
            WHERE user_id = %s 
            ORDER BY option_detail_id
        """, (user_id,))
        option_details = cursor.fetchall()

        # --- Lower part: Payment ---
        # Get all payments linked to the retrieved option_details
        # Collect all option_detail_ids
        payments = []

        cursor.execute("""
                SELECT
                    p.payid,
                    p.option_detail_id,
                    p.amount,
                    p.currency,
                    p.payment_method,
                    p.payment_status,
                    p.pay_date,
                    p.created_at
                FROM option_detail AS od
                JOIN payment AS p
                    ON od.option_detail_id = p.option_detail_id
                WHERE od.user_id = %s
                ORDER BY od.option_detail_id ASC, p.created_at ASC
            """, (user_id,))

        payments = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "option_detail": option_details,
            "payment": payments
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


#-------------- page6: Client/Invoices ----------------
@user_bp.route("/client/<int:user_id>/invoices", methods=["GET"])
@login_required
def get_invoice_client(user_id):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper part: Client ---
        cursor.execute("""
            SELECT id, username, email, created_at, fname, lname, sex, datebirth, phone, role
            FROM users
            WHERE id = %s
        """, (user_id,))
        users = cursor.fetchall()

        # --- Lower part: Invoices ---
        cursor.execute("""
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
                i.notes
            FROM users AS u
            JOIN invoice AS i 
                ON i.ClientID = u.id
            WHERE u.id =%s
            ORDER BY i.InvoiceDate DESC;
        """, (user_id,))
        invoices = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "users": users,
            "invoices": invoices
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})



#-------------- page7: Client/accounts ----------------
@user_bp.route("/client/<int:user_id>/accounts", methods=["GET"])
@login_required
def get_account_client(user_id):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper part: Client ---
        cursor.execute("""
            SELECT id, username, email, created_at, fname, lname, sex, datebirth, phone, role
            FROM users
            WHERE id = %s
        """, (user_id,))
        users = cursor.fetchall()

        # --- Lower part: Accounts ---
        cursor.execute("""
            SELECT 
                a.account_id,
                a.user_id,
                a.balance,
                a.currency,
                a.created_at
            FROM users AS u
            JOIN accounts AS a
                ON a.user_id = u.id
            WHERE u.id = %s
            ORDER BY a.created_at DESC
        """, (user_id,))
        accounts = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "users": users,
            "accounts": accounts
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})        

        
#-------------- page8:  Account/transactions  ----------------
@user_bp.route("/client/<int:user_id>/transactions", methods=["GET"])
@login_required
def get_transactions_client(user_id):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper part: Accounts of the client ---
        cursor.execute("""
            SELECT 
                account_id, user_id, balance, currency, created_at 
            FROM accounts 
            WHERE user_id = %s
            ORDER BY created_at ASC
        """, (user_id,))
        accounts = cursor.fetchall()

        # --- Lower part: Transactions of the client ---
        cursor.execute("""
            SELECT 
                tr.transaction_id, tr.from_account_id, tr.to_account_id,
                tr.amount, tr.currency, tr.transaction_date
            FROM transactions AS tr
            JOIN accounts AS ac ON ac.account_id = tr.from_account_id
            WHERE ac.user_id = %s
            ORDER BY tr.transaction_date DESC
        """, (user_id,))
        transactions = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "accounts": accounts,
            "transactions": transactions
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
 

 #-------------- page9: client/emails  ---------------- 
@user_bp.route("/client/<int:user_id>/emails", methods=["GET"]) 
@login_required
def get_emails_client(user_id): 
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper part: Client info ---
        cursor.execute("""
            SELECT id, username, email, created_at, fname, lname, sex, datebirth, phone, role
            FROM users
            WHERE id = %s
        """, (user_id,))
        users = cursor.fetchall()

        # --- Lower part: Emails ---
        cursor.execute("""
            SELECT 
                em.email_id, em.clientid, em.to_email, em.cc_email,
                em.subject, em.body, em.sent_date, em.status
            FROM emails AS em
            JOIN users AS us ON us.id = em.clientid
            WHERE us.id = %s
            ORDER BY em.sent_date DESC
        """, (user_id,))
        emails = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "users": users,
            "emails": emails
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
    
 
# Serve the send email partial 
@user_bp.route("/client/email_send_partial", methods=["GET"])
@login_required
def email_send_partial():
    return render_template("partials/Client/cl_email_send.html")


@user_bp.route("/client/send_email", methods=["POST"])
@login_required
def send_client_email():
    try:
        user_id  = request.form.get("user_id")
        to_email = request.form.get("to_email")
        cc_email = request.form.get("cc_email")
        subject  = request.form.get("subject")
        body     = request.form.get("body")

        if not user_id or not to_email or not subject:
            return jsonify(success=False, error="Missing required fields")

        # 1️⃣ SEND EMAIL
        send_email(to_email=to_email,cc_email=cc_email,subject=subject,body=body)

        #  2️⃣ SAVE TO DATABASE 
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        sql = """
            INSERT INTO emails
            (clientid, to_email, cc_email, subject, body, status, sent_date)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """
        cursor.execute(sql, (user_id,to_email,cc_email,subject,body,"SENT"))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify(success=True)

    except Exception as e:
        try:
            conn.rollback()
        except:
            pass

        return jsonify(success=False, error=str(e)), 500

# send email 
def send_email(to_email, subject, body, cc_email=None):
    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = subject

    if cc_email:
        msg["Cc"] = cc_email
        recipients = [to_email] + cc_email.split(",")
    else:
        recipients = [to_email]

    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, recipients, msg.as_string())


# attachment email 
@user_bp.route("/client/email_attach", methods=["POST"])
@login_required
def attach_email_file():
    try:
        email_id = request.form.get("email_id")
        file = request.files.get("file")

        if not email_id or not file:
            return jsonify(success=False, error="Missing email_id or file")

        # Only allow certain file types
        ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "docx"}
        if "." not in file.filename or file.filename.rsplit(".", 1)[1].lower() not in ALLOWED_EXTENSIONS:
            return jsonify(success=False, error="File type not allowed")

        # Ensure upload folder exists
        os.makedirs(current_app.config["UPLOAD_FOLDER"], exist_ok=True)

        # Secure the filename
        filename = secure_filename(file.filename)
        save_path = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)

        # Save file
        file.save(save_path)

        # Save to DB
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            INSERT INTO email_attachments (email_id, file_name, file_path)
            VALUES (%s, %s, %s)
        """, (email_id, filename, save_path))
        conn.commit()

        return jsonify(success=True)

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

   
 #-------------- page10: client/feedbacks  ---------------- 
@user_bp.route("/client/<int:user_id>/feedbacks", methods=["GET"]) 
@login_required
def get_feedbacks_client(user_id):
    try:
        db = DBConnection()
        conn = db.connect()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # --- Upper part: Client info ---
        cursor.execute("""
            SELECT id, username, email, created_at, fname, lname, sex, datebirth, phone, role
            FROM users
            WHERE id = %s
        """, (user_id,))
        users = cursor.fetchall()

        # --- Lower part: Feedback ---
        cursor.execute("""
           SELECT feedback_id, user_id, feedback_text,
                    feedback_date, satisfaction_rate 
                FROM feedbacks as fe
                JOIN users AS us ON us.id = fe.user_id
                WHERE us.id = %s
                ORDER BY fe.feedback_date DESC  
        """, (user_id,))
        feedbacks = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "users": users,
            "feedbacks": feedbacks
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


# Serve the send feedback partial
@user_bp.route("/client/feedback_send_partial", methods=["GET"])
@login_required
def feedback_send_partial():
    return render_template("partials/Client/cl_feedback_send.html")


@user_bp.route("/client/send_feedback", methods=["POST"])
@login_required
def send_client_feedback():
    try:
        user_id = request.form.get("user_id")
        dt        = request.form.get("feedback_date")
        rate      = request.form.get("satisfaction_rate")
        txt       = request.form.get("feedback_text")

        if not user_id or not dt or not txt:
            return jsonify(success=False, error="Missing required fields")

        return jsonify(success=True)

    except Exception as e:
        return jsonify(success=False, error=str(e)), 500
    
# -----------------FOR TRIGGERS next/prev --------------------
@user_bp.route("/get_services")
@login_required
def get_services():
    # Fetch from DB
    rows = f_select("services")[0].json  # Or use your own function
    return jsonify(rows)

@user_bp.route("/get_options")
@login_required
def get_options():
    rows = f_select("service_options")[0].json
    return jsonify(rows)

#------------- API Layer  -----------------
@user_bp.route("/update/<int:id>", methods=["POST"])
@login_required
def update(id):
    data = request.json
    validate_required_fields(data)
    rows = f_update("table", data, {"id": id})
    return {"success": rows == 1}

@user_bp.route("/insert", methods=["POST"])
@login_required
def insert():
    data = request.json
    validate_required_fields(data)
    new_id = f_insert("table", data)
    return {"success": True, "new_id": new_id}