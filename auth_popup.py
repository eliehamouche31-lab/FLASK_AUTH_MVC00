# controllers/auth_popup.py
from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash, generate_password_hash
from models.user import User

# ==============================
#  AUTH POPUP CONTROLLER
# ==============================
auth_popup_bp = Blueprint("auth_popup", __name__, url_prefix="/auth_popup")

# Create a single instance of the User class
objuser = User()


# ---------- Utility ----------
def _prefix_img(path):
    """Ensure images have the correct prefix path."""
    if not path:
        return ""
    if path.startswith(("http://", "https://", "/")):
        return path
    return f"/static/img/{path}"

# ---------- LOGIN ----------
@auth_popup_bp.route("/login", methods=["POST"])
def login():
    """Handle user login from popup."""
    data = request.get_json() or {}
    email = (data.get("email") or data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    role = (data.get("role") or "").strip().lower()   # NEW

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password required"}), 400

    return objuser.login(email, password, role)   # PASS ROLE


 
# ---------- REGISTER ----------
@auth_popup_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()
    role = (data.get("role") or "").strip().lower()   # NEW

    return objuser.register(username, email, password, role)


# ---------- LOGOUT ----------

@auth_popup_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

# ---------- CURRENT USER ----------
@auth_popup_bp.route("/current_user", methods=["GET"])
def current_user():
    """Check current user session."""
    username = session.get("username")
    email = session.get("email")

    if username or email:
        return jsonify({
            "logged_in": True,
            "user": {
                "username": username,
                "email": email,
                "welcome": f"Welcome, {username or email}!"
            }
        })

    return jsonify({"logged_in": False, "user": None}) 