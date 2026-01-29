from flask import Flask, jsonify, request

app = Flask(__name__)

# In-memory tasks (replace with DB later)
tasks = [
    {"id": 1, "name": "Alice", "value": 10},
    {"id": 2, "name": "Bob", "value": 20},
    {"id": 3, "name": "Charlie", "value": 30},
    {"id": 4, "name": "Diana", "value": 40},
]

# Helper to get next ID
def next_id():
    return max([t["id"] for t in tasks], default=0) + 1

# GET all tasks
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    return jsonify(tasks)

# POST new task
@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.json
    new_task = {
        "id": next_id(),
        "name": data.get("name", ""),
        "value": data.get("value", 0)
    }
    tasks.append(new_task)
    return jsonify(new_task), 201

# PUT update task
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.json
    for t in tasks:
        if t["id"] == task_id:
            t["name"] = data.get("name", t["name"])
            t["value"] = data.get("value", t["value"])
            return jsonify(t)
    return jsonify({"error": "Task not found"}), 404

# DELETE task
@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    global tasks
    tasks = [t for t in tasks if t["id"] != task_id]
    return jsonify({"status": "deleted"}), 200

if __name__ == "__main__":
    app.run(debug=True)
 