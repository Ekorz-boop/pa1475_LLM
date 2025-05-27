# Use an official Python runtime as a parent image
FROM python:3.11-slim

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

# Environment variable to indicate running inside Docker
ENV IS_DOCKER=true

# Run the command to start the Gunicorn server
# The init_db.py script will be run if the database doesn't exist,
# or you can run it manually when first setting up a persistent volume.
CMD ["sh", "-c", "python init_db.py && gunicorn -w 4 -b 0.0.0.0:5000 server:app"]
