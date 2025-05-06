from flask import Blueprint, render_template, redirect, url_for, flash, request, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.urls import url_parse
from datetime import datetime, timedelta
import secrets
from models import db, User
from forms import (
    LoginForm,
    RegistrationForm,
    ResetPasswordRequestForm,
    ResetPasswordForm,
)
from flask_mail import Message
from extensions import mail

auth = Blueprint("auth", __name__)


@auth.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user is None or not user.check_password(form.password.data):
            flash("Invalid username or password", "error")
            return redirect(url_for("auth.login"))
        login_user(user, remember=form.remember_me.data)
        user.last_login = datetime.utcnow()
        user.login_count = (user.login_count or 0) + 1
        db.session.commit()

        # Get the next page from the session or request args
        next_page = session.get("next") or request.args.get("next")
        # Clear the session
        session.pop("next", None)
        # If no next page or next page is not safe, redirect to index
        if not next_page or url_parse(next_page).netloc != "":
            next_page = url_for("index")
        # If next page is admin, make sure user is admin
        if next_page.startswith("/admin") and not user.is_admin:
            next_page = url_for("index")
        # Prevent redirect loops by checking if next_page is login
        if next_page.startswith("/login"):
            next_page = url_for("index")
        return redirect(next_page)
    return render_template("auth/login.html", form=form)


@auth.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for("auth.login"))


@auth.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash("Congratulations, you are now a registered user!", "success")
        # Get the next page from the session
        next_page = session.get("next")
        if next_page and url_parse(next_page).netloc == "":
            session.pop("next", None)
            return redirect(url_for("auth.login", next=next_page))
        return redirect(url_for("auth.login"))
    return render_template("auth/register.html", form=form)


@auth.route("/reset_password_request", methods=["GET", "POST"])
def reset_password_request():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    form = ResetPasswordRequestForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            token = secrets.token_urlsafe(32)
            user.reset_token = token
            user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
            db.session.commit()
            reset_url = url_for("auth.reset_password", token=token, _external=True)
            msg = Message(
                "Password Reset Request",
                sender="noreply@raggie.com",
                recipients=[user.email],
            )
            msg.body = f"""To reset your password, visit the following link:
{reset_url}

If you did not make this request then simply ignore this email.
"""
            mail.send(msg)
        flash("Check your email for the instructions to reset your password", "info")
        # Get the next page from the session
        next_page = session.get("next")
        if next_page and url_parse(next_page).netloc == "":
            session.pop("next", None)
            return redirect(url_for("auth.login", next=next_page))
        return redirect(url_for("auth.login"))
    return render_template("auth/reset_password_request.html", form=form)


@auth.route("/reset_password/<token>", methods=["GET", "POST"])
def reset_password(token):
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    user = User.query.filter_by(reset_token=token).first()
    if not user or user.reset_token_expiry < datetime.utcnow():
        flash("The password reset link is invalid or has expired", "error")
        return redirect(url_for("auth.reset_password_request"))
    form = ResetPasswordForm()
    if form.validate_on_submit():
        user.set_password(form.password.data)
        user.reset_token = None
        user.reset_token_expiry = None
        db.session.commit()
        flash("Your password has been reset", "success")
        return redirect(url_for("auth.login"))
    return render_template("auth/reset_password.html", form=form)
