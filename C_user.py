# controllers/C_user.py
import io
import os
import datetime
from flask import Blueprint, abort, redirect, render_template, request, jsonify, session, url_for,send_file
import pymysql
from controllers.auth_popup import current_user
from models.db import DBConnection
from models.user import User
from fpdf import FPDF  # ou pdfkit si tu préfères HTML → PDF
import smtplib
from email.message import EmailMessage
from models.crud import f_select, f_select_where, f_insert, f_update, f_delete, validate_required_fields
from functools import wraps

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import pymysql
 
user_bp = Blueprint("C_user", __name__, url_prefix="/user")
user_model = User()
 

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


 # ----------------- REGISTER USER -----------------
@user_bp.route("/register", methods=["POST"], endpoint="user_register")
def register_route():
    data = request.get_json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    user = User()
    return user.register(username, email, password, role)

# ----------------- LOGIN -----------------
@user_bp.route("/login", methods=["POST"], endpoint="user_login")
def login_user():
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