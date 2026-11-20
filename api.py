from pathlib import Path
from flask import Flask, jsonify, render_template, send_from_directory
from netmiko import ConnectHandler

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"

app = Flask(__name__, template_folder=str(TEMPLATES_DIR))

ROUTER = {
    "device_type": "cisco_ios_telnet",
    "host": "192.168.10.12",
    "port": 32770,
    "username": "admin",
    "password": "eve123",
    "secret": "eve123",
}

COMMANDS = [
    "show version",
    "show ip interface brief",
    "show running-config",
]

ALLOWED_TEMPLATE_ASSETS = {
    "style.css": "text/css; charset=utf-8",
    "script.js": "application/javascript; charset=utf-8",
}


@app.route("/", methods=["GET"])
def home():
    return render_template("index.html", results={}, error=None)


@app.route("/<filename>", methods=["GET"])
def template_asset(filename):
    mimetype = ALLOWED_TEMPLATE_ASSETS.get(filename)
    if not mimetype:
        return "Not found", 404
    return send_from_directory(TEMPLATES_DIR, filename, mimetype=mimetype)


@app.route("/connect", methods=["POST"])
def connect():
    results = {}
    error = None
    net_connect = None

    try:
        net_connect = ConnectHandler(**ROUTER)
        net_connect.enable()
        for cmd in COMMANDS:
            try:
                results[cmd] = net_connect.send_command(cmd)
            except Exception as e:
                error = f"Command failed ({cmd}): {e}"
                break
    except Exception as e:
        error = f"Connection failed: {e}"
    finally:
        if net_connect:
            try:
                net_connect.disconnect()
            except Exception as e:
                if error is None:
                    error = f"Disconnect failed: {e}"

    return jsonify(results=results, error=error), (502 if error else 200)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)