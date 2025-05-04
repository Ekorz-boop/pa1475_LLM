# 🛡️ Admin Panel & Authentication – Setup & Usage Guide

## **Features at a Glance**

- **Secure Authentication:** User registration, login, and password reset with strong password hashing.
- **Admin Panel:** Manage users, roles, and system settings with a modern, responsive UI.
- **User Management:** Add, edit, activate/deactivate, reset password, and delete users.
- **Dashboard:** User statistics and user growth analytics.
- **User Growth Analytics:** Visual chart of user signups over time.
- **Settings:** Maintenance mode, security settings, and more.
- **Public Mode:** Toggle to make the main site public (no login required) or private (login required), directly from the admin panel. `/admin` is always protected.
- **Custom Confirmation Modals:** All destructive/admin actions use branded, accessible confirmation dialogs.
- **Fixed Sidebar:** Always-visible, modern sidebar for easy navigation.
- **Modern Card Design:** Soft backgrounds, accent borders, and deep shadows for all admin cards.
- **Accessibility:** ARIA roles, keyboard navigation, and high-contrast text for all major elements.
- **Visual Feedback:** Toast notifications and prominent alert messages for all user actions.
- **Maintenance Mode:** Toggle and customize maintenance mode from the admin panel.
- **Email Notifications:** Password reset and admin actions send emails to users.

---

## **Getting Started**

### **1. Clone the Repository**
```bash
git clone https://github.com/Ekorz-boop/pa1475_LLM
cd yourrepo
```

### **2. Install Dependencies**
```bash
pip install -r requirements.txt
```

### **3. Configure Environment Variables**

Create a `.env` file or set these variables in your environment:

```env
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///app.db  # Or your preferred database URI
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_gmail_app_password
MAIL_DEFAULT_SENDER=your_email@gmail.com
```

> **Tip:** For Gmail, you must use an [App Password](https://support.google.com/accounts/answer/185833?hl=en) if 2FA is enabled.

### **4. Initialize the Database**
```bash
python init_db.py
```
This will create the database and an initial admin user:
- **Username:** `admin`
- **Password:** `admin123`

You can log in with these credentials after setup. (Change the password after first login for security.)

### **5. Run the Application**
```bash
python server.py
```
Visit [http://localhost:5000](http://localhost:5000) in your browser.

---

## **How to Use**

### **Login & Registration**
- Register a new user or log in with the admin account.
- Use the "Forgot password?" link to reset your password via email.

### **Admin Panel**
- Only users with admin privileges can access `/admin`.
- Manage users: add, edit, activate/deactivate, reset password, delete.
- View user statistics.
- Change system settings (maintenance mode, public mode, security, etc.).

### **Public Mode**
- **What is it?**
  - Public mode allows you to make the main site accessible to everyone, with no login required. This is useful for demos, public-facing tools, or when you want to disable authentication for regular users.
  - The admin panel (`/admin`) always remains protected and requires admin login, regardless of public mode.
- **How to enable/disable:**
  - Go to the Admin Panel → Settings.
  - Toggle the "Public Mode" option under "Site Access".
  - Save settings. Changes take effect immediately.
- **Behavior:**
  - **Public Mode ON:** Main site is public, no login required. User/account options are hidden unless logged in. `/admin` is always protected.
  - **Public Mode OFF:** Main site requires login. Users must authenticate to access any non-admin route. `/admin` is always protected.

### **Password Reset**
- Users can request a password reset from the login page.
- Admins can reset any user's password from the admin panel (an email with a new password is sent to the user).

---

## **Customization**

- **Branding:** Update colors, logo, and text in the CSS and HTML templates.
- **Email:** Change the sender address and SMTP settings in `server.py` or your environment.
- **Database:** Use any SQLAlchemy-supported database by changing `DATABASE_URL`.
- **User Roles:** Extend the `User` model and admin panel for more granular permissions if needed.

---

## **Security Notes**

- All passwords are securely hashed (PBKDF2-SHA256).
- All admin and sensitive routes are protected and require authentication.
- Email sending requires valid SMTP credentials.

---

## **Troubleshooting**

- **Email not sending?**  
  Check your SMTP settings and credentials. For Gmail, use an App Password and ensure the sender matches your authenticated account.
- **Database errors?**  
  Make sure you've initialized the database and have the correct URI.

**For more details, see the code comments and inline documentation. If you have questions, open an issue or contact the maintainer.** 