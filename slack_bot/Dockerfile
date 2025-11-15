# slack_bot/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the bot code
COPY . /app/

# Expose the port the bot runs on
EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]