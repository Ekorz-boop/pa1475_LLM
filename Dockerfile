# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code to the working directory
COPY . .

# Ensure the instance directory exists for the SQLite database
RUN mkdir -p instance

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define environment variables
# IMPORTANT: For production, override SECRET_KEY and mail settings securely at runtime.
ENV FLASK_APP=server.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV DATABASE_URL=sqlite:///instance/app.db
ENV SECRET_KEY="your-production-secret-key" 
# Placeholder for mail variables - pass these at runtime
ENV MAIL_SERVER=""
ENV MAIL_PORT=587
ENV MAIL_USE_TLS=True
ENV MAIL_USERNAME=""
ENV MAIL_PASSWORD=""
ENV MAIL_DEFAULT_SENDER=""


# Run the command to start the Gunicorn server
# The init_db.py script will be run if the database doesn't exist,
# or you can run it manually when first setting up a persistent volume.
CMD ["sh", "-c", "python init_db.py && gunicorn -w 4 -b 0.0.0.0:5000 server:app"] 