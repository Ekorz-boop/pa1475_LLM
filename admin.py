from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from functools import wraps
from models import User, AdminPanel, db
from datetime import datetime, timedelta
from forms import AdminUserForm, AdminSettingsForm
from extensions import mail
from flask_mail import Message
from collections import OrderedDict

admin = Blueprint('admin', __name__)

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('You do not have permission to access this page.', 'error')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

@admin.route('/')
@login_required
@admin_required
def admin_panel():
    users = User.query.all()
    admin_settings = AdminPanel.query.first()
    if not admin_settings:
        admin_settings = AdminPanel()
        db.session.add(admin_settings)
        db.session.commit()

    # User growth data for the last 30 days
    days = 30
    date_labels = [(datetime.utcnow() - timedelta(days=i)).strftime('%Y-%m-%d') for i in reversed(range(days))]
    user_growth = OrderedDict((date, 0) for date in date_labels)
    for user in users:
        if user.created_at:
            date_str = user.created_at.strftime('%Y-%m-%d')
            if date_str in user_growth:
                user_growth[date_str] += 1
    user_growth_data = {
        'labels': list(user_growth.keys()),
        'counts': list(user_growth.values())
    }

    return render_template('admin/panel.html', users=users, settings=admin_settings, now=datetime.utcnow, user_growth_data=user_growth_data)

@admin.route('/users')
@login_required
@admin_required
def manage_users():
    users = User.query.all()
    return render_template('admin/users.html', users=users)

@admin.route('/user/<int:user_id>', methods=['GET', 'POST'])
@login_required
@admin_required
def edit_user(user_id):
    user = User.query.get_or_404(user_id)
    form = AdminUserForm(obj=user)
    
    if form.validate_on_submit():
        user.username = form.username.data
        user.email = form.email.data
        user.is_active = form.is_active.data
        user.is_admin = form.is_admin.data
        
        if form.password.data:
            user.set_password(form.password.data)
        
        db.session.commit()
        flash('User updated successfully.', 'success')
        return redirect(url_for('admin.manage_users'))
    
    return render_template('admin/edit_user.html', form=form, user=user)

@admin.route('/user/<int:user_id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        message = 'You cannot delete your own account.'
        if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'message': message}), 400
        flash(message, 'error')
        return redirect(url_for('admin.manage_users'))
    db.session.delete(user)
    db.session.commit()
    message = 'User deleted successfully.'
    if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True, 'message': message})
    flash(message, 'success')
    return redirect(url_for('admin.manage_users'))

@admin.route('/settings', methods=['GET', 'POST'])
@login_required
@admin_required
def admin_settings():
    settings = AdminPanel.query.first()
    if not settings:
        settings = AdminPanel()
        db.session.add(settings)
        db.session.commit()
    
    form = AdminSettingsForm(obj=settings)
    
    if form.validate_on_submit():
        settings.maintenance_mode = form.maintenance_mode.data
        settings.maintenance_message = form.maintenance_message.data
        settings.max_login_attempts = form.max_login_attempts.data
        settings.password_reset_timeout = form.password_reset_timeout.data
        settings.updated_at = datetime.utcnow()
        
        db.session.commit()
        flash('Settings updated successfully.', 'success')
        return redirect(url_for('admin.admin_settings'))
    
    return render_template('admin/settings.html', form=form, settings=settings)

@admin.route('/settings/reset', methods=['POST'])
@login_required
@admin_required
def reset_admin_settings():
    settings = AdminPanel.query.first()
    if not settings:
        settings = AdminPanel()
        db.session.add(settings)
    # Set defaults
    settings.maintenance_mode = False
    settings.maintenance_message = 'System is under maintenance. Please try again later.'
    settings.max_login_attempts = 5
    settings.password_reset_timeout = 3600
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    flash('Settings reset to defaults.', 'success')
    return redirect(url_for('admin.admin_settings'))

@admin.route('/user/<int:user_id>/reset-password', methods=['POST'])
@login_required
@admin_required
def reset_user_password(user_id):
    user = User.query.get_or_404(user_id)
    new_password = User.generate_random_password()
    user.set_password(new_password)
    db.session.commit()
    msg = Message('Your Password Has Been Reset', sender='noreply@raggie.com', recipients=[user.email])
    msg.body = f'''Your password has been reset by an administrator.\nYour new password is: {new_password}\n\nPlease change your password after logging in.\n'''
    mail.send(msg)
    message = 'Password reset email sent to user.'
    if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True, 'message': message})
    flash(message, 'success')
    return redirect(url_for('admin.edit_user', user_id=user_id))

@admin.route('/user/<int:user_id>/toggle-status', methods=['POST'])
@login_required
@admin_required
def toggle_user_status(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        message = 'You cannot deactivate your own account.'
        if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'message': message}), 400
        flash(message, 'error')
        return redirect(url_for('admin.manage_users'))
    user.is_active = not user.is_active
    db.session.commit()
    status = 'activated' if user.is_active else 'deactivated'
    message = f'User {status} successfully.'
    if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True, 'message': message})
    flash(message, 'success')
    return redirect(url_for('admin.manage_users'))

@admin.route('/user/create', methods=['GET', 'POST'])
@login_required
@admin_required
def create_user():
    form = AdminUserForm()
    if form.validate_on_submit():
        user = User(
            username=form.username.data,
            email=form.email.data,
            is_active=form.is_active.data,
            is_admin=form.is_admin.data,
            created_at=datetime.utcnow()
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('User created successfully.', 'success')
        return redirect(url_for('admin.manage_users'))
    return render_template('admin/create_user.html', form=form) 