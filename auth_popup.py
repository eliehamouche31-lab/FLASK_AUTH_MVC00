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
 

# ---------- LOGOUT ----------

@auth_popup_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()           # remove everything from Flask session
    resp = jsonify({'success': True})
    # Clear all cookies related to the session
    resp.set_cookie('session', '', expires=0)
    return resp


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